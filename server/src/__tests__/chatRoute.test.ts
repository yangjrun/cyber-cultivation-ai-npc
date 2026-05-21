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
    expect(created.body.activeSceneId).toBe("black_market");
    expect(Object.keys(created.body.npcStates).sort()).toEqual(["baili", "chimu", "qinggu", "suhe"]);
    expect(created.body.npcStates.baili).toMatchObject({ trust: 20, fear: 10, anger: 0, tianDaoAlert: 45 });
    expect(created.body.quests).toEqual([]);

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
    expect(response.body.state).toEqual({ trust: 23, fear: 11, anger: 0, tianDaoAlert: 45 });
    expect(response.body.memoryAdded).toBe("玩家想要躲避监察院扫描的丹药。");
    expect(response.body.actionResult).toContain("接受任务：偷一枚监察密钥");
    expect(response.body.player).toMatchObject({ name: "陆玄", qiCurrent: 0, qiCap: 100, spiritStones: 0 });
    expect(response.body.replies).toEqual([
      expect.objectContaining({
        npcId: "baili",
        dialogue: "能做，但你得先偷一枚监察密钥。",
        intent: { type: "give_quest", params: { quest_id: "steal_inspector_key" } },
        state: { trust: 23, fear: 11, anger: 0, tianDaoAlert: 45 },
        memoryAdded: "玩家想要躲避监察院扫描的丹药。"
      })
    ]);
    expect(response.body.groupChat).toEqual({ sceneId: "black_market", speakerOrder: ["baili"] });
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

  it("accepts chat for newly registered NPCs (suhe / chimu / qinggu)", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    for (const npcId of ["suhe", "chimu", "qinggu"]) {
      const response = await request(app)
        .post("/api/chat")
        .send({ playerInput: "你好", npcId, sessionId })
        .expect(200);
      expect(response.body.dialogue).toEqual(expect.any(String));
    }
  });

  it("returns ordered group replies for thunder tavern NPCs", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    await request(app)
      .post("/api/scenes/switch")
      .send({ sessionId, sceneId: "thunder_tavern" })
      .expect(200);

    const response = await request(app)
      .post("/api/chat")
      .send({ playerInput: "让我过，顺便打听苏鹤是不是卧底", npcId: "chimu", sessionId })
      .expect(200);

    expect(response.body.dialogue).toBe("过路费，三十灵石。");
    expect(response.body.replies).toHaveLength(2);
    expect(response.body.replies.map((reply: { npcId: string }) => reply.npcId)).toEqual(["chimu", "qinggu"]);
    expect(response.body.replies[0]).toEqual(
      expect.objectContaining({
        npcId: "chimu",
        dialogue: "过路费，三十灵石。",
        state: { trust: 0, fear: 0, anger: 30, tianDaoAlert: 30 },
        memoryAdded: "玩家试图通过赤目的卡口。"
      })
    );
    expect(response.body.replies[1]).toEqual(
      expect.objectContaining({
        npcId: "qinggu",
        dialogue: "你不去验一验？",
        state: { trust: 12, fear: 5, anger: 0, tianDaoAlert: 25 },
        memoryAdded: "玩家怀疑苏鹤的身份，青姑顺势卖了线索。",
        actionResult: ""
      })
    );
    expect(response.body.groupChat).toEqual({ sceneId: "thunder_tavern", speakerOrder: ["chimu", "qinggu"] });
    expect(getRecentMemories(`${sessionId}::chimu`, 5)).toEqual(["玩家试图通过赤目的卡口。"]);
    expect(getRecentMemories(`${sessionId}::qinggu`, 5)).toEqual(["玩家怀疑苏鹤的身份，青姑顺势卖了线索。"]);
  });

  it("walks a quest from give → in_progress → completed (qinggu→suhe verify path)", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    const accept = await request(app)
      .post("/api/chat")
      .send({ playerInput: "我怀疑苏鹤是卧底", npcId: "qinggu", sessionId })
      .expect(200);

    expect(accept.body.intent).toEqual({
      type: "give_quest",
      params: { quest_id: "verify_suhe_identity" }
    });
    expect(accept.body.actionResult).toContain("接受任务");

    let quests = await request(app).get(`/api/quests/${sessionId}`).expect(200);
    expect(quests.body.quests[0].status).toBe("accepted");

    await request(app)
      .post("/api/chat")
      .send({ playerInput: "你是不是监察院的卧底", npcId: "suhe", sessionId })
      .expect(200);

    quests = await request(app).get(`/api/quests/${sessionId}`).expect(200);
    expect(quests.body.quests[0].status).toBe("in_progress");

    for (let i = 0; i < 20; i += 1) {
      await request(app)
        .post("/api/chat")
        .send({ playerInput: "你是不是监察院的卧底", npcId: "suhe", sessionId })
        .expect(200);

      quests = await request(app).get(`/api/quests/${sessionId}`).expect(200);
      if (quests.body.quests[0].status === "completed") {
        break;
      }
    }

    expect(quests.body.quests[0].status).toBe("completed");
  });
});

async function createTestSession(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await request(app).post("/api/session").send({}).expect(201);
  return response.body.sessionId as string;
}
