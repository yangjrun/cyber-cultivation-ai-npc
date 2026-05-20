import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { resetGameState } from "../services/gameState.js";
import { addMemory, clearAllMemoriesForTests } from "../services/memoryStore.js";
import { clearRelationsForTests } from "../services/npcRelationsStore.js";
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
});
