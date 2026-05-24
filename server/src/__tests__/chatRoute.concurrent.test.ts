import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { clearAllMemoriesForTests, getRecentMemories } from "../services/memoryStore.js";
import { resetGameState } from "../services/gameState.js";
import { clearSessionsForTests } from "../services/playerStore.js";
import { clearInventoryForTests } from "../services/inventoryStore.js";
import { clearQuestProgressForTests } from "../services/questStore.js";
import { clearRelationsForTests } from "../services/npcRelationsStore.js";

describe("chat route concurrency", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    process.env.NODE_ENV = "test";
    clearSessionsForTests();
    resetGameState();
    clearAllMemoriesForTests();
    clearInventoryForTests();
    clearQuestProgressForTests();
    clearRelationsForTests();
  });

  it("5 parallel /api/session creates yield 5 distinct sessionIds", async () => {
    const app = createApp();

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => request(app).post("/api/session").send({}))
    );

    for (const res of responses) {
      expect(res.status).toBe(201);
    }
    const ids = responses.map((r) => r.body.sessionId);
    expect(new Set(ids).size).toBe(5);
  });

  it("5 parallel /api/chat on the same session all return 200 without crashing the state", async () => {
    const app = createApp();
    const created = await request(app).post("/api/session").send({}).expect(201);
    const sessionId = created.body.sessionId as string;

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post("/api/chat")
          .send({ playerInput: "买药", npcId: "baili", sessionId })
      )
    );

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.body.dialogue).toEqual(expect.any(String));
      expect(res.body.player.sessionId).toBe(sessionId);
    }

    // Memory accumulation may interleave but all entries must be valid strings from baili
    const memories = getRecentMemories(`${sessionId}::baili`, 10);
    expect(memories.length).toBeGreaterThanOrEqual(1);
    for (const m of memories) {
      expect(typeof m).toBe("string");
      expect(m.length).toBeGreaterThan(0);
    }
  });

  it("parallel chat + reset on same session leave state in a deterministic shape", async () => {
    const app = createApp();
    const created = await request(app).post("/api/session").send({}).expect(201);
    const sessionId = created.body.sessionId as string;

    const [chat, reset] = await Promise.all([
      request(app).post("/api/chat").send({ playerInput: "买药", npcId: "baili", sessionId }),
      request(app).post("/api/chat/reset").send({ npcId: "baili", sessionId })
    ]);

    expect([200]).toContain(chat.status);
    expect([200]).toContain(reset.status);

    // After both complete, an additional reset always yields the initial state
    const finalReset = await request(app)
      .post("/api/chat/reset")
      .send({ npcId: "baili", sessionId })
      .expect(200);

    expect(finalReset.body.state).toEqual({ trust: 20, fear: 10, anger: 0, tianDaoAlert: 45 });
    expect(finalReset.body.memories).toEqual([]);
  });

  it("two sessions' parallel chat do not pollute each other's memory store", async () => {
    const app = createApp();
    const sessionA = (await request(app).post("/api/session").send({}).expect(201)).body
      .sessionId as string;
    const sessionB = (await request(app).post("/api/session").send({}).expect(201)).body
      .sessionId as string;

    await Promise.all([
      request(app)
        .post("/api/chat")
        .send({ playerInput: "我威胁你，不免费就抢", npcId: "baili", sessionId: sessionA })
        .expect(200),
      request(app)
        .post("/api/chat")
        .send({ playerInput: "买", npcId: "baili", sessionId: sessionB })
        .expect(200)
    ]);

    const memA = getRecentMemories(`${sessionA}::baili`, 5);
    const memB = getRecentMemories(`${sessionB}::baili`, 5);

    expect(memA).toEqual(["玩家威胁了白璃。"]);
    expect(memB).toEqual(["玩家向白璃询问交易。"]);
  });
});
