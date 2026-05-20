import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { clearAllMemoriesForTests, getRecentMemories } from "../services/memoryStore.js";
import { getNpcState, resetGameState } from "../services/gameState.js";
import { clearSessionsForTests } from "../services/playerStore.js";

describe("POST /api/chat", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    clearSessionsForTests();
    resetGameState();
    clearAllMemoriesForTests();
  });

  it("creates and restores an anonymous session", async () => {
    const app = createApp();
    const created = await request(app).post("/api/session").send({}).expect(201);

    expect(created.body.sessionId).toEqual(expect.any(String));
    expect(created.body.playerId).toEqual(expect.any(String));
    expect(created.body.player).toMatchObject({
      id: created.body.playerId,
      sessionId: created.body.sessionId,
      name: "陆玄",
      realm: "练气期",
      spiritStones: 0,
      qiCurrent: 0,
      qiCap: 100,
      cultivationStageIdx: 0
    });

    const restored = await request(app).get(`/api/session/${created.body.sessionId}`).expect(200);
    expect(restored.body).toEqual(created.body);
  });

  it("returns a validated mock response without an API key", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);
    const response = await request(app)
      .post("/api/chat")
      .send({ playerInput: "我需要躲过监察院扫描的丹药", npcId: "baili", sessionId })
      .expect(200);

    expect(response.body.dialogue).toBe("能做，但你得先偷一枚监察密钥。");
    expect(response.body.intent).toEqual({ type: "give_quest", params: { quest_id: "steal_inspector_key" } });
    expect(response.body.state).toEqual({ trust: 21, fear: 11, anger: 0, tianDaoAlert: 45 });
    expect(response.body.memoryAdded).toBe("玩家想要躲避监察院扫描的丹药。");
    expect(response.body.actionResult).toBe("任务已触发：偷取监察密钥。");
    expect(response.body.player).toMatchObject({ name: "陆玄", qiCurrent: 0, qiCap: 100, spiritStones: 0 });
    expect(getRecentMemories(`${sessionId}::baili`, 5)).toEqual(["玩家想要躲避监察院扫描的丹药。"]);
  });

  it("updates state for hostile input while keeping values bounded", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);
    const response = await request(app)
      .post("/api/chat")
      .send({ playerInput: "我威胁你，不免费就抢", npcId: "baili", sessionId })
      .expect(200);

    expect(response.body.intent.type).toBe("refuse_service");
    expect(response.body.state).toEqual({ trust: 15, fear: 12, anger: 8, tianDaoAlert: 45 });
    expect(getNpcState(`${sessionId}::baili`)).toEqual(response.body.state);
  });

  it("keeps state and memory isolated by session", async () => {
    const app = createApp();
    const sessionA = await createTestSession(app);
    const sessionB = await createTestSession(app);

    await request(app)
      .post("/api/chat")
      .send({ playerInput: "我威胁你，不免费就抢", npcId: "baili", sessionId: sessionA })
      .expect(200);

    const response = await request(app)
      .post("/api/chat")
      .send({ playerInput: "买", npcId: "baili", sessionId: sessionB })
      .expect(200);

    expect(response.body.state).toEqual({ trust: 20, fear: 10, anger: 0, tianDaoAlert: 45 });
    expect(response.body.player.sessionId).toBe(sessionB);
    expect(getRecentMemories(`${sessionA}::baili`, 5)).toEqual(["玩家威胁了白璃。"]);
    expect(getRecentMemories(`${sessionB}::baili`, 5)).toEqual(["玩家向白璃询问交易。"]);
  });

  it("resets a session scoped state and memory", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    await request(app)
      .post("/api/chat")
      .send({ playerInput: "我威胁你，不免费就抢", npcId: "baili", sessionId })
      .expect(200);

    const response = await request(app)
      .post("/api/chat/reset")
      .send({ npcId: "baili", sessionId })
      .expect(200);

    expect(response.body.state).toEqual({ trust: 20, fear: 10, anger: 0, tianDaoAlert: 45 });
    expect(getRecentMemories(`${sessionId}::baili`, 5)).toEqual([]);
  });

  it("rejects invalid request bodies", async () => {
    const app = createApp();

    const sessionId = await createTestSession(app);

    await request(app).post("/api/chat").send({ playerInput: "", npcId: "baili", sessionId }).expect(400);
    await request(app).post("/api/chat").send({ playerInput: "x".repeat(81), npcId: "baili", sessionId }).expect(400);
    await request(app).post("/api/chat").send({ playerInput: "买药", npcId: "unknown", sessionId }).expect(404);
    await request(app).post("/api/chat").send({ playerInput: "买药", npcId: "baili" }).expect(400);
    await request(app).post("/api/chat").send({ playerInput: "买药", npcId: "baili", sessionId: "missing-session" }).expect(404);
  });
});

async function createTestSession(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await request(app).post("/api/session").send({}).expect(201);
  return response.body.sessionId as string;
}
