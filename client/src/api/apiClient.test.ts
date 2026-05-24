import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJsonWithRetry, HttpError } from "./apiClient";

const okJson = (body: unknown = { ok: true }) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });

const errorResponse = (status: number) =>
  new Response(JSON.stringify({ error: "x" }), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const baseOptions = {
  retryBaseMs: 0,
  retryMaxMs: 0,
  retryJitterMs: 0
} as const;

describe("apiClient fetchJsonWithRetry", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on first 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ hello: "world" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchJsonWithRetry("/api/anything", baseOptions);
    expect(result).toEqual({ hello: "world" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns {} for 204 No Content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchJsonWithRetry("/api/anything", baseOptions);
    expect(result).toEqual({});
  });

  it("retries on 503 then succeeds", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okJson());
    vi.stubGlobal("fetch", fetchMock);

    await fetchJsonWithRetry("/api/anything", { ...baseOptions, retries: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 (any 5xx now, not just 502/503/504)", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(okJson());
    vi.stubGlobal("fetch", fetchMock);

    await fetchJsonWithRetry("/api/anything", { ...baseOptions, retries: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on 429 rate-limit", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(okJson());
    vi.stubGlobal("fetch", fetchMock);

    await fetchJsonWithRetry("/api/anything", { ...baseOptions, retries: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 400/404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(400));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJsonWithRetry("/api/anything", { ...baseOptions, retries: 3 })).rejects.toBeInstanceOf(HttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on network error then succeeds", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(okJson());
    vi.stubGlobal("fetch", fetchMock);

    await fetchJsonWithRetry("/api/anything", { ...baseOptions, retries: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws HttpError with the status after retries exhausted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(502));
    vi.stubGlobal("fetch", fetchMock);

    const err = await fetchJsonWithRetry("/api/anything", { ...baseOptions, retries: 2 }).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("aborts on timeout and retries", async () => {
    vi.useFakeTimers();
    let firstCall = true;
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (firstCall) {
        firstCall = false;
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      }
      return Promise.resolve(okJson());
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchJsonWithRetry("/api/anything", { ...baseOptions, retries: 1, timeoutMs: 100 });
    // advance past the timeout to trigger abort + retry path
    await vi.advanceTimersByTimeAsync(150);
    await vi.runAllTimersAsync();
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
