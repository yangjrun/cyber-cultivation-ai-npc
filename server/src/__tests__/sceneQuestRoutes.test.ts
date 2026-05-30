import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { resetGameState } from "../services/gameState.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";
import { clearRelationsForTests } from "../services/npcRelationsStore.js";
import { clearSessionsForTests } from "../services/playerStore.js";
import { clearQuestProgressForTests } from "../services/questStore.js";
import { clearInventoryForTests } from "../services/inventoryStore.js";

describe("scene + quest routes", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    clearQuestProgressForTests();
    clearRelationsForTests();
    clearAllMemoriesForTests();
    clearInventoryForTests();
    clearSessionsForTests();
    resetGameState();
  });

  it("GET /api/scenes returns all scenes", async () => {
    const app = createApp();
    const res = await request(app).get("/api/scenes").expect(200);

    const sceneIds = res.body.scenes.map((s: { sceneId: string }) => s.sceneId).sort();
    expect(sceneIds).toEqual(["black_market", "inspector_outpost", "player_cave", "thunder_tavern"]);
  });

  it("POST /api/scenes/switch updates active scene", async () => {
    const app = createApp();
    const created = await request(app).post("/api/session").send({}).expect(201);
    const sessionId = created.body.sessionId as string;

    const res = await request(app)
      .post("/api/scenes/switch")
      .send({ sessionId, sceneId: "thunder_tavern" })
      .expect(200);

    expect(res.body).toEqual({ sessionId, activeSceneId: "thunder_tavern" });

    const session = await request(app).get(`/api/session/${sessionId}`).expect(200);
    expect(session.body.activeSceneId).toBe("thunder_tavern");
  });

  it("POST /api/scenes/switch rejects unknown scene", async () => {
    const app = createApp();
    const created = await request(app).post("/api/session").send({}).expect(201);
    const sessionId = created.body.sessionId as string;

    await request(app)
      .post("/api/scenes/switch")
      .send({ sessionId, sceneId: "fake_scene" })
      .expect(404);
  });

  it("GET /api/scenes/:sceneId/snapshot returns NPC profiles + states", async () => {
    const app = createApp();
    const created = await request(app).post("/api/session").send({}).expect(201);
    const sessionId = created.body.sessionId as string;

    const res = await request(app)
      .get(`/api/scenes/thunder_tavern/snapshot`)
      .query({ sessionId })
      .expect(200);

    expect(res.body.scene.sceneId).toBe("thunder_tavern");
    const npcIds = res.body.npcs.map((n: { profile: { npc_id: string } }) => n.profile.npc_id);
    expect(npcIds.sort()).toEqual(["chimu", "qinggu"]);
  });

  it("GET /api/quests/:sessionId returns enriched progress", async () => {
    const app = createApp();
    const created = await request(app).post("/api/session").send({}).expect(201);
    const sessionId = created.body.sessionId as string;

    const empty = await request(app).get(`/api/quests/${sessionId}`).expect(200);
    expect(empty.body.quests).toEqual([]);

    await request(app)
      .post("/api/chat")
      .send({ playerInput: "我需要躲过监察院扫描的丹药", npcId: "baili", sessionId })
      .expect(200);

    const after = await request(app).get(`/api/quests/${sessionId}`).expect(200);
    expect(after.body.quests).toHaveLength(1);
    expect(after.body.quests[0].questId).toBe("steal_inspector_key");
    expect(after.body.quests[0].definition.title).toBe("偷一枚监察密钥");
  });

  it("GET /api/quests/definitions returns all quest definitions", async () => {
    const app = createApp();
    const res = await request(app).get("/api/quests/definitions").expect(200);

    const ids = res.body.definitions.map((d: { questId: string }) => d.questId).sort();
    expect(ids).toEqual([
      "baili_delivery_run",
      "chimu_toll_collection",
      "pay_thunder_toll",
      "qinggu_verify_rumor",
      "steal_inspector_key",
      "suhe_intel_errand",
      "verify_suhe_identity"
    ]);
  });
});
