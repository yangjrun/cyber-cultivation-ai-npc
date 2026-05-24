import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { resetGameState } from "../services/gameState.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";
import { clearInventoryForTests } from "../services/inventoryStore.js";
import { clearQuestProgressForTests } from "../services/questStore.js";
import { clearRelationsForTests } from "../services/npcRelationsStore.js";
import { clearSessionsForTests } from "../services/playerStore.js";
import {
  clearWorldStateForTests,
  evaluateMilestones,
  getUnlockedMilestones,
  getWorldState,
  isMilestoneUnlocked,
  recordFlag,
  setFlag
} from "../services/worldStateEngine.js";

async function createSession(): Promise<string> {
  const app = createApp();
  const res = await request(app).post("/api/session").send({}).expect(201);
  return res.body.sessionId as string;
}

describe("worldStateEngine", () => {
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

  it("recordFlag upserts and accumulates", async () => {
    const sessionId = await createSession();
    expect(recordFlag(sessionId, "completed_trades", 1)).toBe(1);
    expect(recordFlag(sessionId, "completed_trades", 1)).toBe(2);
    expect(recordFlag(sessionId, "completed_trades", 3)).toBe(5);

    expect(getWorldState(sessionId)).toEqual({ completed_trades: 5 });
  });

  it("setFlag overrides without accumulating", async () => {
    const sessionId = await createSession();
    recordFlag(sessionId, "spoke_about_undercover", 7);
    setFlag(sessionId, "spoke_about_undercover", 1);
    expect(getWorldState(sessionId)).toEqual({ spoke_about_undercover: 1 });
  });

  it("getWorldState returns empty object for sessions with no flags", async () => {
    const sessionId = await createSession();
    expect(getWorldState(sessionId)).toEqual({});
  });

  it("evaluateMilestones unlocks market_regular when completed_trades >= 5", async () => {
    const sessionId = await createSession();
    for (let i = 0; i < 5; i += 1) recordFlag(sessionId, "completed_trades");

    const result = evaluateMilestones(sessionId);

    expect(result.newlyUnlocked).toContain("market_regular");
    expect(isMilestoneUnlocked(sessionId, "market_regular")).toBe(true);
  });

  it("evaluateMilestones unlocks huashen_seed when cultivationStageIdx >= 12", async () => {
    const sessionId = await createSession();
    // Bump player straight to stage 12 (金丹中后期)
    const { updatePlayer } = await import("../services/playerStore.js");
    updatePlayer(sessionId, { cultivationStageIdx: 12 });

    const result = evaluateMilestones(sessionId);
    expect(result.newlyUnlocked).toContain("huashen_seed");
  });

  it("evaluateMilestones unlocks lei_survivor when high_alert_breakthrough flag set", async () => {
    const sessionId = await createSession();
    recordFlag(sessionId, "high_alert_breakthrough");

    const result = evaluateMilestones(sessionId);
    expect(result.newlyUnlocked).toContain("lei_survivor");
  });

  it("evaluateMilestones is idempotent (same milestone unlocks at most once)", async () => {
    const sessionId = await createSession();
    for (let i = 0; i < 5; i += 1) recordFlag(sessionId, "completed_trades");

    const first = evaluateMilestones(sessionId);
    expect(first.newlyUnlocked).toContain("market_regular");

    const second = evaluateMilestones(sessionId);
    expect(second.newlyUnlocked).not.toContain("market_regular");
    expect(second.allUnlocked.map((m) => m.id)).toContain("market_regular");
  });

  it("getUnlockedMilestones returns chronological list with timestamps", async () => {
    const sessionId = await createSession();
    for (let i = 0; i < 5; i += 1) recordFlag(sessionId, "completed_trades");
    evaluateMilestones(sessionId);

    const list = getUnlockedMilestones(sessionId);
    expect(list.length).toBeGreaterThan(0);
    for (const entry of list) {
      expect(entry.id).toBeTruthy();
      expect(entry.unlockedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("returns empty result when sessionId does not exist (no crash)", () => {
    const result = evaluateMilestones("11111111-1111-4111-8111-111111111111");
    expect(result.newlyUnlocked).toEqual([]);
    expect(result.allUnlocked).toEqual([]);
  });

  it("requires sessionAgeMs > threshold for lone_wolf", async () => {
    const sessionId = await createSession();
    // Fresh session has age ~0, should NOT unlock lone_wolf yet
    const result = evaluateMilestones(sessionId);
    expect(result.newlyUnlocked).not.toContain("lone_wolf");
  });

  it("does not unlock informant without trust(suhe) < -10", async () => {
    const sessionId = await createSession();
    recordFlag(sessionId, "spoke_about_undercover");
    const result = evaluateMilestones(sessionId);
    // suhe default trust is 0 (not yet < -10), so milestone should NOT unlock
    expect(result.newlyUnlocked).not.toContain("informant");
  });
});
