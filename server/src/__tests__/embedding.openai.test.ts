import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMBEDDING_DIM } from "../services/embedding/index.js";
import { openAiEmbeddingProvider } from "../services/embedding/openaiProvider.js";
import { getMetricsSnapshot, resetMetricsForTests } from "../services/observability.js";

const okEmbedding = (count: number = 1) =>
  new Response(
    JSON.stringify({
      data: Array.from({ length: count }, () => ({
        embedding: makeUnitVector(EMBEDDING_DIM)
      }))
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );

const errorResponse = (status: number) =>
  new Response(JSON.stringify({ error: { type: "upstream" } }), {
    status,
    headers: { "Content-Type": "application/json" }
  });

function makeUnitVector(dim: number): number[] {
  return Array.from({ length: dim }, (_, i) => (i === 0 ? 1 : 0));
}

describe("openAiEmbeddingProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://relay.example.com/v1";
    process.env.EMBEDDING_MODEL = "text-embedding-3-small";
    process.env.EMBEDDING_RETRY_BASE_MS = "0";
    process.env.EMBEDDING_RETRY_MAX_MS = "0";
    process.env.EMBEDDING_RETRY_JITTER_MS = "0";
    resetMetricsForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
    resetMetricsForTests();
  });

  it("calls POST /v1/embeddings with model + input + dimensions and parses the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okEmbedding(1));
    vi.stubGlobal("fetch", fetchMock);

    const vec = await openAiEmbeddingProvider.embed("白璃在炼丹");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://relay.example.com/v1/embeddings");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.model).toBe("text-embedding-3-small");
    expect(body.dimensions).toBe(EMBEDDING_DIM);
    expect(body.input).toEqual(["白璃在炼丹"]);

    expect(vec).toBeInstanceOf(Float32Array);
    expect(vec.length).toBe(EMBEDDING_DIM);
  });

  it("embedBatch returns one vector per input", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okEmbedding(3));
    vi.stubGlobal("fetch", fetchMock);

    const out = await openAiEmbeddingProvider.embedBatch(["a", "b", "c"]);
    expect(out).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("empty embedBatch input returns empty array without hitting fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await openAiEmbeddingProvider.embedBatch([]);
    expect(out).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries on 503 then succeeds, records retries=N in observability", async () => {
    process.env.EMBEDDING_MAX_RETRIES = "2";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(502))
      .mockResolvedValueOnce(okEmbedding(1));
    vi.stubGlobal("fetch", fetchMock);

    await openAiEmbeddingProvider.embed("x");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const snap = getMetricsSnapshot();
    const embed = snap.perCallSite.find((p) => p.callSite === "embedding");
    expect(embed?.successCount).toBe(1);
    expect(embed?.retryCount).toBe(2);
  });

  it("retries on 429 then fails when retries exhausted", async () => {
    process.env.EMBEDDING_MAX_RETRIES = "1";
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(429));
    vi.stubGlobal("fetch", fetchMock);

    await expect(openAiEmbeddingProvider.embed("x")).rejects.toThrow(/status 429/);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const snap = getMetricsSnapshot();
    const embed = snap.perCallSite.find((p) => p.callSite === "embedding");
    expect(embed?.errorBreakdown.http_429).toBe(1);
  });

  it("does NOT retry on 400", async () => {
    process.env.EMBEDDING_MAX_RETRIES = "3";
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(400));
    vi.stubGlobal("fetch", fetchMock);

    await expect(openAiEmbeddingProvider.embed("x")).rejects.toThrow(/status 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const snap = getMetricsSnapshot();
    const embed = snap.perCallSite.find((p) => p.callSite === "embedding");
    expect(embed?.errorBreakdown.http_4xx).toBe(1);
  });

  it("retries on network error then succeeds", async () => {
    process.env.EMBEDDING_MAX_RETRIES = "1";
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(okEmbedding(1));
    vi.stubGlobal("fetch", fetchMock);

    await openAiEmbeddingProvider.embed("x");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const snap = getMetricsSnapshot();
    expect(snap.perCallSite[0]?.retryCount).toBe(1);
  });

  it("returns fatal error when response data length mismatches input", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okEmbedding(2)); // 2 returned, 1 requested
    vi.stubGlobal("fetch", fetchMock);

    await expect(openAiEmbeddingProvider.embed("x")).rejects.toThrow(/data\[\*\]\.embedding/);

    const snap = getMetricsSnapshot();
    expect(snap.perCallSite[0]?.errorBreakdown.parse).toBe(1);
  });

  it("falls back to LLM_API_KEY / LLM_BASE_URL when OPENAI_EMBEDDING_* unset", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okEmbedding(1));
    vi.stubGlobal("fetch", fetchMock);

    await openAiEmbeddingProvider.embed("x");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
  });

  it("prefers OPENAI_EMBEDDING_* over LLM_* when both are set", async () => {
    process.env.OPENAI_EMBEDDING_API_KEY = "embed-key";
    process.env.OPENAI_EMBEDDING_BASE_URL = "https://embed.example.com/v1";
    const fetchMock = vi.fn().mockResolvedValue(okEmbedding(1));
    vi.stubGlobal("fetch", fetchMock);

    await openAiEmbeddingProvider.embed("x");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://embed.example.com/v1/embeddings");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer embed-key");
  });

  it("resolveEndpoint handles base URL with /embeddings suffix", async () => {
    process.env.LLM_BASE_URL = "https://relay.example.com/v1/embeddings";
    const fetchMock = vi.fn().mockResolvedValue(okEmbedding(1));
    vi.stubGlobal("fetch", fetchMock);

    await openAiEmbeddingProvider.embed("x");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://relay.example.com/v1/embeddings");
  });

  it("resolveEndpoint handles root base URL without /v1", async () => {
    process.env.LLM_BASE_URL = "https://relay.example.com";
    const fetchMock = vi.fn().mockResolvedValue(okEmbedding(1));
    vi.stubGlobal("fetch", fetchMock);

    await openAiEmbeddingProvider.embed("x");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://relay.example.com/v1/embeddings");
  });
});
