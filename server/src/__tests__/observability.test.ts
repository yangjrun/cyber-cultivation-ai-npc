import { beforeEach, describe, expect, it } from "vitest";
import {
  getMetricsSnapshot,
  recordArbiterFallback,
  recordLlmCall,
  resetMetricsForTests
} from "../services/observability.js";

describe("observability", () => {
  beforeEach(() => {
    resetMetricsForTests();
    delete process.env.OBSERVABILITY_BUFFER_SIZE;
  });

  it("aggregates totals across mock + real + error records", () => {
    recordLlmCall({ callSite: "baili", apiFormat: "mock", durationMs: 0, success: true, retries: 0, timestamp: Date.now() });
    recordLlmCall({ callSite: "baili", apiFormat: "openai", durationMs: 120, success: true, retries: 1, tokensIn: 80, tokensOut: 30, timestamp: Date.now() });
    recordLlmCall({ callSite: "arbiter", apiFormat: "claude", durationMs: 240, success: false, errorKind: "http_5xx", retries: 2, timestamp: Date.now() });

    const snapshot = getMetricsSnapshot();

    expect(snapshot.totals).toEqual({ calls: 3, errors: 1, mockHits: 1, arbiterFallbacks: 0 });
    expect(snapshot.perCallSite).toHaveLength(2);

    const baili = snapshot.perCallSite.find((p) => p.callSite === "baili");
    const arbiter = snapshot.perCallSite.find((p) => p.callSite === "arbiter");

    expect(baili).toMatchObject({
      totalCalls: 2,
      successCount: 2,
      errorCount: 0,
      mockHitCount: 1,
      retryCount: 1,
      tokens: { inTotal: 80, outTotal: 30 }
    });
    expect(arbiter?.errorBreakdown.http_5xx).toBe(1);
    expect(arbiter?.errorCount).toBe(1);
    expect(arbiter?.retryCount).toBe(2);
  });

  it("computes p50/p95 latency from samples", () => {
    const callSite = "baili";
    const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    for (const ms of latencies) {
      recordLlmCall({ callSite, apiFormat: "openai", durationMs: ms, success: true, retries: 0, timestamp: Date.now() });
    }
    const snapshot = getMetricsSnapshot();
    const stats = snapshot.perCallSite[0]?.latency;

    expect(stats?.p50).toBeCloseTo(55, 1);
    expect(stats?.p95).toBeCloseTo(95.5, 1);
    expect(stats?.max).toBe(100);
    expect(stats?.mean).toBe(55);
  });

  it("computes cacheHitRatio from cache read/creation tokens", () => {
    recordLlmCall({
      callSite: "baili",
      apiFormat: "claude",
      durationMs: 200,
      success: true,
      retries: 0,
      tokensIn: 100,
      tokensOut: 50,
      cacheReadTokens: 800,
      cacheCreationTokens: 100,
      timestamp: Date.now()
    });
    const stats = getMetricsSnapshot().perCallSite[0]?.tokens;
    expect(stats?.cacheReadTotal).toBe(800);
    expect(stats?.cacheCreationTotal).toBe(100);
    expect(stats?.cacheHitRatio).toBeCloseTo(800 / (800 + 100 + 100), 4);
  });

  it("recordArbiterFallback updates totals.arbiterFallbacks only", () => {
    recordArbiterFallback("timeout");
    recordArbiterFallback("network");

    const snapshot = getMetricsSnapshot();
    expect(snapshot.totals.arbiterFallbacks).toBe(2);
    expect(snapshot.totals.calls).toBe(0);
    expect(snapshot.perCallSite).toHaveLength(0);
  });

  it("ring buffer trims oldest records past OBSERVABILITY_BUFFER_SIZE but keeps totals", () => {
    process.env.OBSERVABILITY_BUFFER_SIZE = "3";
    for (let i = 0; i < 5; i += 1) {
      recordLlmCall({
        callSite: "baili",
        apiFormat: "openai",
        durationMs: i,
        success: i % 2 === 0,
        errorKind: i % 2 === 0 ? undefined : "network",
        retries: 0,
        timestamp: Date.now()
      });
    }
    const snapshot = getMetricsSnapshot();
    // totals stay cumulative even after trim
    expect(snapshot.totals.calls).toBe(5);
    expect(snapshot.totals.errors).toBe(2);
    // but per-callSite aggregates only see the last 3
    expect(snapshot.perCallSite[0]?.totalCalls).toBe(3);
  });

  it("returns empty snapshot after reset", () => {
    recordLlmCall({ callSite: "baili", apiFormat: "mock", durationMs: 0, success: true, retries: 0, timestamp: Date.now() });
    resetMetricsForTests();
    const snapshot = getMetricsSnapshot();
    expect(snapshot.totals.calls).toBe(0);
    expect(snapshot.perCallSite).toEqual([]);
  });
});
