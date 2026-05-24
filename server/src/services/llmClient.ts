import Anthropic from "@anthropic-ai/sdk";
import { getMockResponder } from "./mockResponders/index.js";
import { recordLlmCall, type LlmApiFormat, type LlmErrorKind } from "./observability.js";
import type { LlmMessage, LlmTextBlock } from "../types/llm.js";

type RequestLlmInput = {
  messages: LlmMessage[];
  playerInput: string;
  npcId?: string;
};

type TokenUsage = {
  tokensIn?: number;
  tokensOut?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
};

type AttemptOutcome =
  | { kind: "success"; value: string; tokens?: TokenUsage }
  | { kind: "retryable"; errorKind: LlmErrorKind; error: Error }
  | { kind: "fatal"; errorKind: LlmErrorKind; error: Error };

type RetryOptions = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMaxMs: number;
};

class RetryFailure extends Error {
  constructor(readonly errorKind: LlmErrorKind, readonly retries: number, readonly cause: Error) {
    super(cause.message);
    this.name = "RetryFailure";
  }
}

export async function generateNpcResponse(prompt: string, playerInput: string, npcId: string = "baili"): Promise<string> {
  return requestLlm({
    messages: [{ role: "system", content: prompt }],
    playerInput,
    npcId
  });
}

export async function requestLlm({ messages, playerInput, npcId = "baili" }: RequestLlmInput): Promise<string> {
  const callSite = npcId;
  const startedAt = Date.now();

  if (!process.env.LLM_API_KEY) {
    recordLlmCall({
      callSite,
      apiFormat: "mock",
      durationMs: 0,
      success: true,
      retries: 0,
      timestamp: startedAt
    });
    return JSON.stringify(getMockResponder(npcId)(playerInput));
  }

  return executeRealLlmRequest(messages, callSite, startedAt);
}

type RequestLlmTextInput = {
  messages: LlmMessage[];
  callSite: string;
  mockFallback: () => string;
};

export async function requestLlmText({ messages, callSite, mockFallback }: RequestLlmTextInput): Promise<string> {
  const startedAt = Date.now();

  if (!process.env.LLM_API_KEY) {
    recordLlmCall({
      callSite,
      apiFormat: "mock",
      durationMs: 0,
      success: true,
      retries: 0,
      timestamp: startedAt
    });
    return mockFallback();
  }

  return executeRealLlmRequest(messages, callSite, startedAt);
}

async function executeRealLlmRequest(messages: LlmMessage[], callSite: string, startedAt: number): Promise<string> {
  const model = process.env.LLM_MODEL;
  if (!model) {
    throw new Error("LLM_MODEL is required when LLM_API_KEY is set");
  }

  const apiFormat: LlmApiFormat = process.env.LLM_API_FORMAT === "claude" ? "claude" : "openai";
  const attempt = apiFormat === "claude"
    ? () => attemptClaudeMessages(model, messages)
    : () => attemptOpenAiCompatible(model, messages);

  try {
    const { value, retries, tokens } = await withRetry(attempt, readRetryOptions());
    recordLlmCall({
      callSite,
      apiFormat,
      durationMs: Date.now() - startedAt,
      success: true,
      retries,
      tokensIn: tokens?.tokensIn,
      tokensOut: tokens?.tokensOut,
      cacheReadTokens: tokens?.cacheReadTokens,
      cacheCreationTokens: tokens?.cacheCreationTokens,
      timestamp: startedAt
    });
    return value;
  } catch (failure) {
    if (failure instanceof RetryFailure) {
      recordLlmCall({
        callSite,
        apiFormat,
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
      apiFormat,
      durationMs: Date.now() - startedAt,
      success: false,
      errorKind: "other",
      retries: 0,
      timestamp: startedAt
    });
    throw failure;
  }
}

async function withRetry(
  attempt: () => Promise<AttemptOutcome>,
  options: RetryOptions
): Promise<{ value: string; retries: number; tokens?: TokenUsage }> {
  let attemptIdx = 0;

  while (true) {
    const outcome = await attempt();

    if (outcome.kind === "success") {
      return { value: outcome.value, retries: attemptIdx, tokens: outcome.tokens };
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
    maxRetries: parseNonNegativeInt(process.env.LLM_MAX_RETRIES, 2),
    baseDelayMs: parseNonNegativeInt(process.env.LLM_RETRY_BASE_MS, 300),
    maxDelayMs: parseNonNegativeInt(process.env.LLM_RETRY_MAX_MS, 3000),
    jitterMaxMs: parseNonNegativeInt(process.env.LLM_RETRY_JITTER_MS, 200)
  };
}

function parseNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

async function attemptOpenAiCompatible(model: string, messages: LlmMessage[]): Promise<AttemptOutcome> {
  const baseUrl = process.env.LLM_BASE_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    return {
      kind: "fatal",
      errorKind: "other",
      error: new Error("LLM_BASE_URL is required for OpenAI-compatible LLM requests")
    };
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 15000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(resolveEndpoint(baseUrl, "/chat/completions"), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLM_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: messages.map((message) => ({
          role: message.role,
          content: stringifyContent(message.content)
        })),
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorKind = classifyHttpStatus(response.status);
      const error = new Error(`LLM request failed with status ${response.status}`);
      return {
        kind: errorKind === "http_4xx" ? "fatal" : "retryable",
        errorKind,
        error
      };
    }

    const payload = await response.json() as unknown;
    const content = extractOpenAiMessageContent(payload);

    if (!content) {
      return {
        kind: "fatal",
        errorKind: "parse",
        error: new Error("LLM response did not include message content")
      };
    }

    return { kind: "success", value: content, tokens: extractOpenAiTokenUsage(payload) };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        kind: "retryable",
        errorKind: "timeout",
        error: new Error("LLM request timed out")
      };
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

async function attemptClaudeMessages(model: string, messages: LlmMessage[]): Promise<AttemptOutcome> {
  const client = new Anthropic({
    apiKey: process.env.LLM_API_KEY,
    authToken: null,
    baseURL: resolveClaudeBaseUrl(process.env.LLM_BASE_URL),
    timeout: Number(process.env.LLM_TIMEOUT_MS ?? 15000),
    maxRetries: 0,
    defaultHeaders: {
      "anthropic-version": process.env.ANTHROPIC_VERSION ?? "2023-06-01"
    }
  });

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 512,
      system: toClaudeSystem(messages),
      messages: toClaudeMessages(messages)
    });
    const content = extractClaudeMessageContent(response);

    if (!content) {
      return {
        kind: "fatal",
        errorKind: "parse",
        error: new Error("LLM response did not include message content")
      };
    }

    return { kind: "success", value: content, tokens: extractClaudeTokenUsage(response) };
  } catch (error) {
    return classifyClaudeError(error);
  }
}

function classifyClaudeError(error: unknown): AttemptOutcome {
  const err = error instanceof Error ? error : new Error(String(error));
  const name = err.name;

  if (name === "APIConnectionTimeoutError") {
    return { kind: "retryable", errorKind: "timeout", error: err };
  }

  if (name === "APIConnectionError") {
    return { kind: "retryable", errorKind: "network", error: err };
  }

  const status = extractStatus(error);
  if (status === 429) {
    return { kind: "retryable", errorKind: "http_429", error: err };
  }
  if (status !== undefined && status >= 500) {
    return { kind: "retryable", errorKind: "http_5xx", error: err };
  }
  if (status !== undefined && status >= 400) {
    return { kind: "fatal", errorKind: "http_4xx", error: err };
  }

  return { kind: "retryable", errorKind: "other", error: err };
}

function extractStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  return typeof error.status === "number" ? error.status : undefined;
}

function classifyHttpStatus(status: number): LlmErrorKind {
  if (status === 429) return "http_429";
  if (status >= 500) return "http_5xx";
  return "http_4xx";
}

function toClaudeSystem(messages: LlmMessage[]): Anthropic.TextBlockParam[] | undefined {
  const blocks = messages
    .filter((message) => message.role === "system")
    .flatMap((message) => toClaudeTextBlocks(message.content));

  return blocks.length > 0 ? blocks : undefined;
}

function toClaudeMessages(messages: LlmMessage[]): Anthropic.MessageParam[] {
  const nonSystem = messages.filter((message) => message.role !== "system");

  if (nonSystem.length === 0) {
    return [{ role: "user", content: "继续。" }];
  }

  return nonSystem.map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: typeof message.content === "string" ? message.content : toClaudeTextBlocks(message.content)
  }));
}

function toClaudeTextBlocks(content: string | LlmTextBlock[]): Anthropic.TextBlockParam[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }

  return content.map((block) => ({
    type: "text",
    text: block.text,
    ...(block.cacheControl ? { cache_control: block.cacheControl } : {})
  }));
}

function resolveEndpoint(baseUrl: string, path: "/chat/completions"): string {
  if (baseUrl.endsWith(path)) {
    return baseUrl;
  }

  if (baseUrl.endsWith("/v1")) {
    return `${baseUrl}${path}`;
  }

  return `${baseUrl}/v1${path}`;
}

function resolveClaudeBaseUrl(baseUrl: string | undefined): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  const normalized = baseUrl.replace(/\/$/, "");

  if (normalized.endsWith("/v1/messages")) {
    return normalized.slice(0, -"/v1/messages".length);
  }

  if (normalized.endsWith("/v1")) {
    return normalized.slice(0, -"/v1".length);
  }

  return normalized;
}

function extractClaudeMessageContent(response: unknown): string | null {
  const payload = typeof response === "string" ? parseJson(response) : response;

  if (!isRecord(payload) || !Array.isArray(payload.content)) {
    return null;
  }

  const textBlocks = payload.content
    .filter((block): block is Record<string, unknown> => isRecord(block) && block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string);

  return textBlocks.length > 0 ? textBlocks.join("\n") : null;
}

function extractClaudeTokenUsage(response: unknown): TokenUsage | undefined {
  if (!isRecord(response) || !isRecord(response.usage)) return undefined;
  const usage = response.usage;
  const tokens: TokenUsage = {};
  if (typeof usage.input_tokens === "number") tokens.tokensIn = usage.input_tokens;
  if (typeof usage.output_tokens === "number") tokens.tokensOut = usage.output_tokens;
  if (typeof usage.cache_read_input_tokens === "number") tokens.cacheReadTokens = usage.cache_read_input_tokens;
  if (typeof usage.cache_creation_input_tokens === "number") tokens.cacheCreationTokens = usage.cache_creation_input_tokens;
  return Object.keys(tokens).length > 0 ? tokens : undefined;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function extractOpenAiMessageContent(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return null;
  }

  const [choice] = payload.choices;

  if (!isRecord(choice) || !isRecord(choice.message) || typeof choice.message.content !== "string") {
    return null;
  }

  return choice.message.content;
}

function extractOpenAiTokenUsage(payload: unknown): TokenUsage | undefined {
  if (!isRecord(payload) || !isRecord(payload.usage)) return undefined;
  const usage = payload.usage;
  const tokens: TokenUsage = {};
  if (typeof usage.prompt_tokens === "number") tokens.tokensIn = usage.prompt_tokens;
  if (typeof usage.completion_tokens === "number") tokens.tokensOut = usage.completion_tokens;
  return Object.keys(tokens).length > 0 ? tokens : undefined;
}

function stringifyContent(content: string | LlmTextBlock[]): string {
  if (typeof content === "string") {
    return content;
  }

  return content.map((block) => block.text).join("\n\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
