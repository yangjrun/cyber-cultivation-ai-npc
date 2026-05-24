import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";
import { resetGameState } from "../services/gameState.js";
import { clearSessionsForTests } from "../services/playerStore.js";
import { clearInventoryForTests } from "../services/inventoryStore.js";
import { clearQuestProgressForTests } from "../services/questStore.js";
import { clearRelationsForTests } from "../services/npcRelationsStore.js";

describe("POST /api/session with custom body", () => {
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

  it("uses default 陆玄 when no body is provided", async () => {
    const app = createApp();
    const res = await request(app).post("/api/session").send({}).expect(201);

    expect(res.body.player.name).toBe("陆玄");
    expect(res.body.player.visibleTraits).toEqual(["右臂义体", "雷罚残痕", "非法灵根波形"]);
  });

  it("overrides name when provided", async () => {
    const app = createApp();
    const res = await request(app).post("/api/session").send({ name: "夜辰" }).expect(201);
    expect(res.body.player.name).toBe("夜辰");
  });

  it("rejects name longer than 12 characters", async () => {
    const app = createApp();
    await request(app)
      .post("/api/session")
      .send({ name: "x".repeat(13) })
      .expect(400);
  });

  it("rejects empty / whitespace-only name", async () => {
    const app = createApp();
    await request(app).post("/api/session").send({ name: "   " }).expect(400);
  });

  it("overrides roots when provided", async () => {
    const app = createApp();
    const customRoots = { metal: 10, wood: 20, water: 30, fire: 40, earth: 50 };
    const res = await request(app).post("/api/session").send({ roots: customRoots }).expect(201);
    expect(res.body.player.roots).toEqual(customRoots);
  });

  it("rejects roots values out of 0-100 range", async () => {
    const app = createApp();
    await request(app)
      .post("/api/session")
      .send({ roots: { metal: 200, wood: 0, water: 0, fire: 0, earth: 0 } })
      .expect(400);
    await request(app)
      .post("/api/session")
      .send({ roots: { metal: -1, wood: 0, water: 0, fire: 0, earth: 0 } })
      .expect(400);
  });

  it("rejects roots missing required elements", async () => {
    const app = createApp();
    await request(app)
      .post("/api/session")
      .send({ roots: { metal: 10, wood: 10, water: 10, fire: 10 } as Record<string, number> })
      .expect(400);
  });

  it("replaces visibleTraits when traitId is provided (yiti_arm)", async () => {
    const app = createApp();
    const res = await request(app).post("/api/session").send({ traitId: "yiti_arm" }).expect(201);
    expect(res.body.player.visibleTraits).toEqual(["右臂义体", "金属共鸣残响"]);
  });

  it("replaces visibleTraits when traitId is provided (leifa_scar)", async () => {
    const app = createApp();
    const res = await request(app).post("/api/session").send({ traitId: "leifa_scar" }).expect(201);
    expect(res.body.player.visibleTraits).toEqual(["雷罚残痕", "焚天体质"]);
  });

  it("rejects unknown traitId", async () => {
    const app = createApp();
    await request(app).post("/api/session").send({ traitId: "huashen" }).expect(400);
  });

  it("rejects extra unknown fields (strict schema)", async () => {
    const app = createApp();
    await request(app)
      .post("/api/session")
      .send({ name: "夜辰", malicious: "foo" } as Record<string, unknown>)
      .expect(400);
  });

  it("GET /api/session/traits returns the 3 trait options", async () => {
    const app = createApp();
    const res = await request(app).get("/api/session/traits").expect(200);
    expect(res.body.traits).toHaveLength(3);
    const ids = res.body.traits.map((t: { id: string }) => t.id).sort();
    expect(ids).toEqual(["feifagen", "leifa_scar", "yiti_arm"]);
  });
});
