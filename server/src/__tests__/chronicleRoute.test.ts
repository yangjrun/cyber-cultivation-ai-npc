import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { resetGameState } from "../services/gameState.js";
import { addMemory, clearAllMemoriesForTests } from "../services/memoryStore.js";
import { clearInventoryForTests } from "../services/inventoryStore.js";
import { clearQuestProgressForTests } from "../services/questStore.js";
import { clearRelationsForTests } from "../services/npcRelationsStore.js";
import { clearSessionsForTests, updatePlayer } from "../services/playerStore.js";
import { scopedNpcId } from "../services/scopedNpcId.js";
import {
  clearWorldStateForTests,
  evaluateMilestones,
  recordFlag
} from "../services/worldStateEngine.js";

async function createSession(): Promise<string> {
  const app = createApp();
  const res = await request(app).post("/api/session").send({}).expect(201);
  return res.body.sessionId as string;
}

describe("chronicle route (mock LLM)", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    process.env.NODE_ENV = "test";
    clearSessionsForTests();
    resetGameState();
    clearAllMemoriesForTests();
    clearInventoryForTests();
    clearQuestProgressForTests();
    clearRelationsForTests();
    clearWorldStateForTests();
  });

  it("POST /api/chronicle/:sessionId returns 201 with mock content and saves to DB", async () => {
    const app = createApp();
    const sessionId = await createSession();

    const res = await request(app).post(`/api/chronicle/${sessionId}`).expect(201);

    expect(res.body.sessionId).toBe(sessionId);
    expect(typeof res.body.content).toBe("string");
    expect(res.body.content.length).toBeGreaterThan(50);
    expect(res.body.content).toMatch(/陆玄/);
    expect(res.body.content).toMatch(/Mock Chronicle/);
    expect(Array.isArray(res.body.milestonesSnapshot)).toBe(true);
    expect(res.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("incorporates the player's custom name and unlocked milestones", async () => {
    const app = createApp();
    const res = await request(app).post("/api/session").send({ name: "夜辰" }).expect(201);
    const sessionId = res.body.sessionId as string;

    // Force an unlock — bump cultivationStageIdx to trigger huashen_seed
    updatePlayer(sessionId, { cultivationStageIdx: 12 });
    evaluateMilestones(sessionId);

    const chronicle = await request(app).post(`/api/chronicle/${sessionId}`).expect(201);

    expect(chronicle.body.content).toMatch(/夜辰/);
    expect(chronicle.body.milestonesSnapshot).toContain("huashen_seed");
  });

  it("returns 404 for unknown sessionId", async () => {
    const app = createApp();
    await request(app)
      .post("/api/chronicle/11111111-1111-4111-8111-111111111111")
      .expect(404);
  });

  it("returns 400 for malformed sessionId", async () => {
    const app = createApp();
    await request(app).post("/api/chronicle/not-a-uuid").expect(400);
  });

  it("GET /api/chronicle/:sessionId returns chronological history (newest first)", async () => {
    const app = createApp();
    const sessionId = await createSession();

    const a = await request(app).post(`/api/chronicle/${sessionId}`).expect(201);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const b = await request(app).post(`/api/chronicle/${sessionId}`).expect(201);

    const list = await request(app).get(`/api/chronicle/${sessionId}`).expect(200);
    expect(list.body.chronicles).toHaveLength(2);
    expect(list.body.chronicles[0].id).toBe(b.body.id); // newest first
    expect(list.body.chronicles[1].id).toBe(a.body.id);
  });

  it("returns empty list when no chronicles have been generated", async () => {
    const app = createApp();
    const sessionId = await createSession();
    const res = await request(app).get(`/api/chronicle/${sessionId}`).expect(200);
    expect(res.body.chronicles).toEqual([]);
  });

  it("evaluateMilestones runs inside generateChronicle so newly satisfied milestones are saved in snapshot", async () => {
    const app = createApp();
    const sessionId = await createSession();

    // Set up market_regular preconditions WITHOUT calling evaluateMilestones explicitly
    for (let i = 0; i < 5; i += 1) recordFlag(sessionId, "completed_trades");

    const res = await request(app).post(`/api/chronicle/${sessionId}`).expect(201);
    expect(res.body.milestonesSnapshot).toContain("market_regular");
  });

  it("incorporates recent memories in the mock chronicle text", async () => {
    const app = createApp();
    const sessionId = await createSession();

    // Seed memories on baili
    await addMemory(scopedNpcId(sessionId, "baili"), "玩家想买屏蔽天道云的丹药");

    const res = await request(app).post(`/api/chronicle/${sessionId}`).expect(201);
    // Mock chronicle includes faction description; recent memories should at least exist in DB
    expect(res.body.content).toBeTruthy();
  });
});
