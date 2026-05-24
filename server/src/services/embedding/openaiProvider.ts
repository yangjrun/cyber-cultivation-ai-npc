import { EMBEDDING_DIM, type EmbeddingProvider, type EmbeddingVector } from "../../types/embedding.js";
import { recordLlmCall, type LlmErrorKind } from "../observability.js";

type AttemptOutcome<T> =
  | { kind: "success"; value: T }
  | { kind: "retryable"; errorKind: LlmErrorKind; error: Error }
  | { kind: "fatal"; errorKind: LlmErrorKind; error: Error };

type RetryOptions = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMaxMs: number;
};

class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly dim = EMBEDDING_DIM;

  async embed(text: string): Promise<EmbeddingVector> {
    const [vector] = await this.embedBatch([text]);
    return vector ?? new Float32Array(EMBEDDING_DIM);
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    if (texts.length === 0) {
      return [];
    }

    const callSite = "embedding";
    const startedAt = Date.now();

    try {
      const { value, retries } = await withRetry<EmbeddingVector[]>(
        () => attemptOpenAiEmbedding(texts),
        readRetryOptions()
      );
      recordLlmCall({
        callSite,
        apiFormat: "openai",
        durationMs: Date.now() - startedAt,
        success: true,
        retries,
        timestamp: startedAt
      });
      return value;
    } catch (failure) {
      if (failure instanceof RetryFailure) {
        recordLlmCall({
          callSite,
          apiFormat: "openai",
          durationMs: Date.now() - startedAt,
          success: false,
          errorKind: failure.errorKind,
          retries: failure.retries,
          timestamp: startedAt
        });
        throw failure.cause;
      }
      recordLlmCall({
        callSite,
        apiFormat: "openai",
        durationMs: Date.now() - startedAt,
        success: false,
        errorKind: "other",
        retries: 0,
        timestamp: startedAt
      });
      throw failure;
    }
  }
}

export const openAiEmbeddingProvider: EmbeddingProvider = new OpenAiEmbeddingProvider();

export function isOpenAiEmbeddingConfigured(): boolean {
  const apiKey = process.env.OPENAI_EMBEDDING_API_KEY ?? process.env.LLM_API_KEY;
  const baseUrl = process.env.OPENAI_EMBEDDING_BASE_URL ?? process.env.LLM_BASE_URL;
  return Boolean(apiKey && baseUrl);
}

async function attemptOpenAiEmbedding(texts: string[]): Promise<AttemptOutcome<EmbeddingVector[]>> {
  const baseUrl = (process.env.OPENAI_EMBEDDING_BASE_URL ?? process.env.LLM_BASE_URL)?.replace(/\/$/, "");
  const apiKey = process.env.OPENAI_EMBEDDING_API_KEY ?? process.env.LLM_API_KEY;
  const model = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

  if (!baseUrl || !apiKey) {
    return {
      kind: "fatal",
      errorKind: "other",
      error: new Error("OPENAI_EMBEDDING_BASE_URL/LLM_BASE_URL and OPENAI_EMBEDDING_API_KEY/LLM_API_KEY are required")
    };
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.EMBEDDING_TIMEOUT_MS ?? process.env.LLM_TIMEOUT_MS ?? 15000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(resolveEndpoint(baseUrl), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, input: texts, dimensions: EMBEDDING_DIM })
    });

    if (!response.ok) {
      const errorKind = classifyHttpStatus(response.status);
      return {
        kind: errorKind === "http_4xx" ? "fatal" : "retryable",
        errorKind,
        error: new Error(`Embedding request failed with status ${response.status}`)
      };
    }

    const payload = (await response.json()) as unknown;
    const vectors = extractEmbeddings(payload, texts.length);

    if (!vectors) {
      return {
        kind: "fatal",
        errorKind: "parse",
        error: new Error("Embedding response did not include data[*].embedding")
      };
    }

    return { kind: "success", value: vectors };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { kind: "retryable", errorKind: "timeout", error: new Error("Embedding request timed out") };
    }
    return {
      kind: "retryable",
      errorKind: "network",
      error: error instanceof Error ? error : new Error(String(error))
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

class RetryFailure extends Error {
  constructor(readonly errorKind: LlmErrorKind, readonly retries: number, readonly cause: Error) {
    super(cause.message);
    this.name = "RetryFailure";
  }
}

async function withRetry<T>(
  attempt: () => Promise<AttemptOutcome<T>>,
  options: RetryOptions
): Promise<{ value: T; retries: number }> {
  let attemptIdx = 0;

  while (true) {
    const outcome = await attempt();

    if (outcome.kind === "success") {
      return { value: outcome.value, retries: attemptIdx };
    }

    if (outcome.kind === "fatal" || attemptIdx >= options.maxRetries) {
      throw new RetryFailure(outcome.errorKind, attemptIdx, outcome.error);
    }

    const delay = computeBackoff(attemptIdx, options);
    if (delay > 0) {
      await sleep(delay);
    }
    attemptIdx += 1;
  }
}

function computeBackoff(attemptIdx: number, options: RetryOptions): number {
  const exponential = options.baseDelayMs * 2 ** attemptIdx;
  const capped = options.maxDelayMs > 0 ? Math.min(options.maxDelayMs, exponential) : exponential;
  const jitter = options.jitterMaxMs > 0 ? Math.floor(Math.random() * options.jitterMaxMs) : 0;
  return capped + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readRetryOptions(): RetryOptions {
  return {
    maxRetries: parseNonNegativeInt(process.env.EMBEDDING_MAX_RETRIES ?? process.env.LLM_MAX_RETRIES, 2),
    baseDelayMs: parseNonNegativeInt(process.env.EMBEDDING_RETRY_BASE_MS ?? process.env.LLM_RETRY_BASE_MS, 300),
    maxDelayMs: parseNonNegativeInt(process.env.EMBEDDING_RETRY_MAX_MS ?? process.env.LLM_RETRY_MAX_MS, 3000),
    jitterMaxMs: parseNonNegativeInt(process.env.EMBEDDING_RETRY_JITTER_MS ?? process.env.LLM_RETRY_JITTER_MS, 200)
  };
}

function parseNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function resolveEndpoint(baseUrl: string): string {
  if (baseUrl.endsWith("/embeddings")) return baseUrl;
  if (baseUrl.endsWith("/v1")) return `${baseUrl}/embeddings`;
  return `${baseUrl}/v1/embeddings`;
}

function classifyHttpStatus(status: number): LlmErrorKind {
  if (status === 429) return "http_429";
  if (status >= 500) return "http_5xx";
  return "http_4xx";
}

function extractEmbeddings(payload: unknown, expectedCount: number): EmbeddingVector[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return null;
  }
  if (payload.data.length !== expectedCount) {
    return null;
  }

  const vectors: EmbeddingVector[] = [];

  for (const entry of payload.data) {
    if (!isRecord(entry) || !Array.isArray(entry.embedding)) {
      return null;
    }
    if (entry.embedding.length !== EMBEDDING_DIM) {
      return null;
    }
    const vec = new Float32Array(EMBEDDING_DIM);
    for (let i = 0; i < EMBEDDING_DIM; i += 1) {
      const value = entry.embedding[i];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
      }
      vec[i] = value;
    }
    vectors.push(vec);
  }

  return vectors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
