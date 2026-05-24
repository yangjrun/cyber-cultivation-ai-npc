import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestLlm } from "../services/llmClient.js";
import { getMetricsSnapshot, resetMetricsForTests } from "../services/observability.js";

const okResponse = () => new Response(
  JSON.stringify({
    choices: [{ message: { content: "{\"dialogue\":\"ok\"}" } }],
    usage: { prompt_tokens: 12, completion_tokens: 5 }
  }),
  { status: 200, headers: { "Content-Type": "application/json" } }
);

const errorResponse = (status: number) => new Response(
  JSON.stringify({ error: { type: "upstream" } }),
  { status, headers: { "Content-Type": "application/json" } }
);

describe("llmClient retry + observability", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://relay.example.com/v1";
    process.env.LLM_MODEL = "test-model";
    process.env.LLM_RETRY_BASE_MS = "0";
    process.env.LLM_RETRY_MAX_MS = "0";
    process.env.LLM_RETRY_JITTER_MS = "0";
    resetMetricsForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
    resetMetricsForTests();
  });

  it("retries 5xx then succeeds and records retries=N in metrics", async () => {
    process.env.LLM_MAX_RETRIES = "2";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(502))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const content = await requestLlm({ messages: [{ role: "system", content: "x" }], playerInput: "hi", npcId: "baili" });

    expect(content).toBe("{\"dialogue\":\"ok\"}");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const snap = getMetricsSnapshot();
    const baili = snap.perCallSite.find((p) => p.callSite === "baili");
    expect(baili?.successCount).toBe(1);
    expect(baili?.retryCount).toBe(2);
    expect(baili?.tokens.inTotal).toBe(12);
    expect(baili?.tokens.outTotal).toBe(5);
  });

  it("retries 429 (rate-limit) before failing when retries exhausted", async () => {
    process.env.LLM_MAX_RETRIES = "1";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(errorResponse(429));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestLlm({ messages: [{ role: "system", content: "x" }], playerInput: "hi", npcId: "arbiter" })).rejects.toThrow(/status 429/);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const snap = getMetricsSnapshot();
    const arbiter = snap.perCallSite.find((p) => p.callSite === "arbiter");
    expect(arbiter?.errorCount).toBe(1);
    expect(arbiter?.errorBreakdown.http_429).toBe(1);
    expect(arbiter?.retryCount).toBe(1);
  });

  it("does NOT retry 4xx (e.g. 400 bad request)", async () => {
    process.env.LLM_MAX_RETRIES = "3";
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(400));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestLlm({ messages: [{ role: "system", content: "x" }], playerInput: "hi", npcId: "baili" })).rejects.toThrow(/status 400/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const snap = getMetricsSnapshot();
    const baili = snap.perCallSite.find((p) => p.callSite === "baili");
    expect(baili?.errorBreakdown.http_4xx).toBe(1);
    expect(baili?.retryCount).toBe(0);
  });

  it("retries on network error then succeeds", async () => {
    process.env.LLM_MAX_RETRIES = "1";
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const content = await requestLlm({ messages: [{ role: "system", content: "x" }], playerInput: "hi", npcId: "baili" });

    expect(content).toBe("{\"dialogue\":\"ok\"}");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const snap = getMetricsSnapshot();
    const baili = snap.perCallSite.find((p) => p.callSite === "baili");
    expect(baili?.successCount).toBe(1);
    expect(baili?.retryCount).toBe(1);
  });

  it("returns mock response without LLM_API_KEY and records mock-hit metric", async () => {
    delete process.env.LLM_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const content = await requestLlm({ messages: [{ role: "system", content: "x" }], playerInput: "你好", npcId: "baili" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(typeof content).toBe("string");

    const snap = getMetricsSnapshot();
    expect(snap.totals.mockHits).toBe(1);
    expect(snap.perCallSite[0]?.mockHitCount).toBe(1);
  });

  it("records success with retries=0 when first attempt is 200", async () => {
    process.env.LLM_MAX_RETRIES = "2";
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await requestLlm({ messages: [{ role: "system", content: "x" }], playerInput: "hi", npcId: "baili" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const snap = getMetricsSnapshot();
    expect(snap.perCallSite[0]?.retryCount).toBe(0);
    expect(snap.perCallSite[0]?.successCount).toBe(1);
  });

  it("retries on AbortError (timeout) then succeeds and tags errorKind=timeout when exhausted", async () => {
    process.env.LLM_MAX_RETRIES = "1";
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const content = await requestLlm({ messages: [{ role: "system", content: "x" }], playerInput: "hi", npcId: "baili" });

    expect(content).toBe("{\"dialogue\":\"ok\"}");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const snap = getMetricsSnapshot();
    const baili = snap.perCallSite.find((p) => p.callSite === "baili");
    expect(baili?.successCount).toBe(1);
    expect(baili?.retryCount).toBe(1);
  });

  it("classifies AbortError as timeout and records errorBreakdown.timeout when all retries fail", async () => {
    process.env.LLM_MAX_RETRIES = "1";
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestLlm({ messages: [{ role: "system", content: "x" }], playerInput: "hi", npcId: "baili" })).rejects.toThrow(/timed out/);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const snap = getMetricsSnapshot();
    const baili = snap.perCallSite.find((p) => p.callSite === "baili");
    expect(baili?.errorBreakdown.timeout).toBe(1);
    expect(baili?.retryCount).toBe(1);
  });

  it("rate-limit: exhausts retries on sustained 429 burst and counts every 429 in retries", async () => {
    process.env.LLM_MAX_RETRIES = "3";
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(429));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestLlm({ messages: [{ role: "system", content: "x" }], playerInput: "hi", npcId: "arbiter" })).rejects.toThrow(/status 429/);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const snap = getMetricsSnapshot();
    const arbiter = snap.perCallSite.find((p) => p.callSite === "arbiter");
    expect(arbiter?.errorCount).toBe(1);
    expect(arbiter?.errorBreakdown.http_429).toBe(1);
    expect(arbiter?.retryCount).toBe(3);
  });

  it("rate-limit: recovers when 429 burst is followed by 200, retries=N tracks attempts", async () => {
    process.env.LLM_MAX_RETRIES = "3";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const content = await requestLlm({ messages: [{ role: "system", content: "x" }], playerInput: "hi", npcId: "arbiter" });

    expect(content).toBe("{\"dialogue\":\"ok\"}");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const snap = getMetricsSnapshot();
    const arbiter = snap.perCallSite.find((p) => p.callSite === "arbiter");
    expect(arbiter?.successCount).toBe(1);
    expect(arbiter?.retryCount).toBe(2);
    expect(arbiter?.errorBreakdown.http_429).toBe(0);
  });

  it("concurrent: aggregates metrics correctly across N parallel calls and multiple callSites", async () => {
    process.env.LLM_MAX_RETRIES = "1";
    const attemptsByKey = new Map<string, number>();
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const key = body.messages[0]?.content ?? "";
      const prior = attemptsByKey.get(key) ?? 0;
      attemptsByKey.set(key, prior + 1);
      // arbiter-* fails on first attempt, succeeds on retry. baili-* always ok.
      if (key.startsWith("arbiter-") && prior === 0) {
        return errorResponse(503);
      }
      return okResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    const calls = [
      requestLlm({ messages: [{ role: "system", content: "baili-call-1" }], playerInput: "hi", npcId: "baili" }),
      requestLlm({ messages: [{ role: "system", content: "baili-call-2" }], playerInput: "hi", npcId: "baili" }),
      requestLlm({ messages: [{ role: "system", content: "arbiter-call-1" }], playerInput: "hi", npcId: "arbiter" }),
      requestLlm({ messages: [{ role: "system", content: "arbiter-call-2" }], playerInput: "hi", npcId: "arbiter" }),
      requestLlm({ messages: [{ role: "system", content: "baili-call-3" }], playerInput: "hi", npcId: "baili" })
    ];

    const results = await Promise.all(calls);
    expect(results).toHaveLength(5);
    expect(results.every((r) => r === "{\"dialogue\":\"ok\"}")).toBe(true);

    const snap = getMetricsSnapshot();
    expect(snap.totals.calls).toBe(5);
    expect(snap.totals.errors).toBe(0);

    const baili = snap.perCallSite.find((p) => p.callSite === "baili");
    const arbiter = snap.perCallSite.find((p) => p.callSite === "arbiter");

    expect(baili?.totalCalls).toBe(3);
    expect(baili?.successCount).toBe(3);
    expect(baili?.retryCount).toBe(0);

    expect(arbiter?.totalCalls).toBe(2);
    expect(arbiter?.successCount).toBe(2);
    expect(arbiter?.retryCount).toBe(2);
  });
});
