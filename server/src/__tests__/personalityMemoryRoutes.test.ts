import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { resetGameState } from "../services/gameState.js";
import { clearAllMemoriesForTests, addMemory } from "../services/memoryStore.js";
import { clearRelationsForTests } from "../services/npcRelationsStore.js";
import { clearPersonalityForTests, evaluateRules, recordEvents } from "../services/personalityEvolution.js";
import { clearSessionsForTests } from "../services/playerStore.js";
import { clearQuestProgressForTests } from "../services/questStore.js";
import { clearInventoryForTests } from "../services/inventoryStore.js";
import { scopedNpcId } from "../services/scopedNpcId.js";

describe("personality + memory routes", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    clearQuestProgressForTests();
    clearRelationsForTests();
    clearAllMemoriesForTests();
    clearInventoryForTests();
    clearPersonalityForTests();
    clearSessionsForTests();
    resetGameState();
  });

  it("GET /api/personality returns evolved record after threshold met", async () => {
    const app = createApp();
    const created = await request(app).post("/api/session").send({}).expect(201);
    const sessionId = created.body.sessionId as string;

    for (let i = 0; i < 5; i += 1) {
      recordEvents(sessionId, "baili", ["threat"]);
    }
    evaluateRules(sessionId, "baili");

    const res = await request(app).get(`/api/personality/${sessionId}/baili`).expect(200);

    expect(res.body.npcId).toBe("baili");
    expect(res.body.evolvedTraits.length).toBeGreaterThan(0);
    expect(res.body.counters.threats).toBe(5);
  });

  it("DELETE /api/personality resets traits + counters", async () => {
    const app = createApp();
    const created = await request(app).post("/api/session").send({}).expect(201);
    const sessionId = created.body.sessionId as string;

    for (let i = 0; i < 5; i += 1) recordEvents(sessionId, "baili", ["threat"]);
    evaluateRules(sessionId, "baili");

    await request(app).delete(`/api/personality/${sessionId}/baili`).expect(200);
    const after = await request(app).get(`/api/personality/${sessionId}/baili`).expect(200);
    expect(after.body.evolvedTraits).toEqual([]);
    expect(after.body.counters).toEqual({});
  });

  it("GET /api/memory returns recent memories ordered newest first", async () => {
    const app = createApp();
    const created = await request(app).post("/api/session").send({}).expect(201);
    const sessionId = created.body.sessionId as string;
    const scoped = scopedNpcId(sessionId, "baili");

    await addMemory(scoped, "玩家第一次到店");
    await addMemory(scoped, "玩家询问屏蔽丹");
    await addMemory(scoped, "玩家提到苏鹤");

    const res = await request(app).get(`/api/memory/${sessionId}/baili`).expect(200);

    expect(res.body.memories[0].content).toBe("玩家提到苏鹤");
    expect(res.body.memories).toHaveLength(3);
  });

  it("GET /api/memory honors limit param", async () => {
    const app = createApp();
    const created = await request(app).post("/api/session").send({}).expect(201);
    const sessionId = created.body.sessionId as string;
    const scoped = scopedNpcId(sessionId, "baili");

    for (let i = 0; i < 10; i += 1) {
      await addMemory(scoped, `memory-${i}`);
    }

    const res = await request(app).get(`/api/memory/${sessionId}/baili`).query({ limit: 3 }).expect(200);
    expect(res.body.memories).toHaveLength(3);
  });

  it("returns 404 for unknown session or NPC", async () => {
    const app = createApp();
    const fakeSessionId = "11111111-1111-4111-8111-111111111111";

    await request(app).get(`/api/personality/${fakeSessionId}/baili`).expect(404);
    await request(app).get(`/api/memory/${fakeSessionId}/baili`).expect(404);

    const created = await request(app).post("/api/session").send({}).expect(201);
    await request(app).get(`/api/personality/${created.body.sessionId}/unknown`).expect(404);
    await request(app).get(`/api/memory/${created.body.sessionId}/unknown`).expect(404);
  });
});
