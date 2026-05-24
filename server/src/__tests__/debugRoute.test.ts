import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { resetGameState } from "../services/gameState.js";
import { addMemory, clearAllMemoriesForTests } from "../services/memoryStore.js";
import { clearRelationsForTests } from "../services/npcRelationsStore.js";
import { recordArbiterFallback, recordLlmCall, resetMetricsForTests } from "../services/observability.js";
import { clearSessionsForTests } from "../services/playerStore.js";
import { clearQuestProgressForTests } from "../services/questStore.js";
import { clearInventoryForTests } from "../services/inventoryStore.js";
import { scopedNpcId } from "../services/scopedNpcId.js";

describe("debug routes", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    process.env.NODE_ENV = "test";
    clearQuestProgressForTests();
    clearRelationsForTests();
    clearAllMemoriesForTests();
    clearInventoryForTests();
    clearSessionsForTests();
    resetGameState();
    resetMetricsForTests();
  });

  it("GET /api/debug/memory returns retrieved + recent for an NPC", async () => {
    const app = createApp();
    const created = await request(app).post("/api/session").send({}).expect(201);
    const sessionId = created.body.sessionId as string;
    const scoped = scopedNpcId(sessionId, "baili");

    await addMemory(scoped, "玩家想买屏蔽天道云的丹药");
    await addMemory(scoped, "玩家提到雷罚帮赤目");
    await addMemory(scoped, "玩家又问起天道云");

    const res = await request(app)
      .get(`/api/debug/memory/${sessionId}/baili`)
      .query({ q: "天道云屏蔽丹药", k: 2 })
      .expect(200);

    expect(res.body.sessionId).toBe(sessionId);
    expect(res.body.npcId).toBe("baili");
    expect(res.body.query).toBe("天道云屏蔽丹药");
    expect(res.body.k).toBe(2);
    expect(res.body.retrieved).toHaveLength(2);
    expect(res.body.retrieved[0].score).toBeGreaterThan(res.body.retrieved[1].score);
    expect(res.body.recent.length).toBeGreaterThan(0);
  });

  it("returns 400 when q is missing or too long", async () => {
    const app = createApp();
    const created = await request(app).post("/api/session").send({}).expect(201);
    const sessionId = created.body.sessionId as string;

    await request(app).get(`/api/debug/memory/${sessionId}/baili`).expect(400);
    await request(app).get(`/api/debug/memory/${sessionId}/baili`).query({ q: "x".repeat(201) }).expect(400);
  });

  it("returns 404 for unknown session and NPC", async () => {
    const app = createApp();
    const fakeSessionId = "11111111-1111-4111-8111-111111111111";

    await request(app).get(`/api/debug/memory/${fakeSessionId}/baili`).query({ q: "test" }).expect(404);

    const created = await request(app).post("/api/session").send({}).expect(201);
    await request(app).get(`/api/debug/memory/${created.body.sessionId}/unknown`).query({ q: "test" }).expect(404);
  });

  it("GET /api/debug/metrics returns empty snapshot before any calls", async () => {
    const app = createApp();

    const res = await request(app).get("/api/debug/metrics").expect(200);

    expect(res.body.totals).toEqual({ calls: 0, errors: 0, mockHits: 0, arbiterFallbacks: 0 });
    expect(res.body.perCallSite).toEqual([]);
    expect(typeof res.body.startedAt).toBe("number");
    expect(typeof res.body.uptimeSec).toBe("number");
  });

  it("GET /api/debug/metrics reflects recorded calls + arbiter fallbacks", async () => {
    const app = createApp();

    recordLlmCall({ callSite: "baili", apiFormat: "claude", durationMs: 180, success: true, retries: 0, tokensIn: 100, tokensOut: 30, cacheReadTokens: 500, cacheCreationTokens: 50, timestamp: Date.now() });
    recordLlmCall({ callSite: "baili", apiFormat: "claude", durationMs: 220, success: false, errorKind: "http_5xx", retries: 1, timestamp: Date.now() });
    recordLlmCall({ callSite: "arbiter", apiFormat: "claude", durationMs: 90, success: true, retries: 0, timestamp: Date.now() });
    recordArbiterFallback("simulated");

    const res = await request(app).get("/api/debug/metrics").expect(200);

    expect(res.body.totals.calls).toBe(3);
    expect(res.body.totals.errors).toBe(1);
    expect(res.body.totals.arbiterFallbacks).toBe(1);

    const baili = res.body.perCallSite.find((p: { callSite: string }) => p.callSite === "baili");
    expect(baili.totalCalls).toBe(2);
    expect(baili.errorCount).toBe(1);
    expect(baili.errorBreakdown.http_5xx).toBe(1);
    expect(baili.tokens.inTotal).toBe(100);
    expect(baili.tokens.cacheReadTotal).toBe(500);
    expect(baili.tokens.cacheHitRatio).toBeGreaterThan(0);
  });
});
