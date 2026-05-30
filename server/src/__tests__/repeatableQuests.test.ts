import { beforeEach, describe, expect, it } from "vitest";
import { resetGameState } from "../services/gameState.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";
import { clearRelationsForTests } from "../services/npcRelationsStore.js";
import { clearSessionsForTests, createSession, getPlayer } from "../services/playerStore.js";
import { evaluateIntent, markQuestFlag } from "../services/questEngine.js";
import { clearQuestProgressForTests, getQuestProgress, upsertQuestProgress } from "../services/questStore.js";
import { scopedNpcId } from "../services/scopedNpcId.js";
import { clearInventoryForTests } from "../services/inventoryStore.js";

const REPEATABLE_QUEST = "baili_delivery_run";

describe("repeatable quests", () => {
  beforeEach(() => {
    clearQuestProgressForTests();
    clearRelationsForTests();
    clearAllMemoriesForTests();
    clearInventoryForTests();
    clearSessionsForTests();
    resetGameState();
  });

  function acceptAndComplete(sessionId: string): void {
    const scoped = scopedNpcId(sessionId, "baili");

    // Accept the repeatable quest
    evaluateIntent(sessionId, scoped, {
      type: "give_quest",
      params: { quest_id: REPEATABLE_QUEST }
    });

    // Transition accepted -> in_progress
    evaluateIntent(sessionId, scoped, { type: "none", params: {} });

    // Set completion flag, then trigger completion
    markQuestFlag(sessionId, REPEATABLE_QUEST, "delivery_done", true);
    evaluateIntent(sessionId, scoped, { type: "none", params: {} });
  }

  it("completes a repeatable quest and grants stones", () => {
    const session = createSession();
    const before = getPlayer(session.sessionId)?.spiritStones ?? 0;

    acceptAndComplete(session.sessionId);

    const progress = getQuestProgress(session.sessionId, REPEATABLE_QUEST);
    expect(progress?.status).toBe("completed");

    const after = getPlayer(session.sessionId)?.spiritStones ?? 0;
    expect(after).toBe(before + 35); // baili_delivery_run reward
  });

  it("blocks re-acceptance during cooldown", () => {
    const session = createSession();
    acceptAndComplete(session.sessionId);

    const scoped = scopedNpcId(session.sessionId, "baili");

    // Try to re-accept immediately (within cooldown)
    const result = evaluateIntent(session.sessionId, scoped, {
      type: "give_quest",
      params: { quest_id: REPEATABLE_QUEST }
    });

    // Should not transition back to accepted
    expect(result.statusChanges).toEqual([]);
    const progress = getQuestProgress(session.sessionId, REPEATABLE_QUEST);
    expect(progress?.status).toBe("completed");
  });

  it("allows re-acceptance after cooldown elapses", () => {
    const session = createSession();
    acceptAndComplete(session.sessionId);

    // Simulate cooldown elapsed by backdating completedAt beyond 48h
    const pastTime = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();
    const current = getQuestProgress(session.sessionId, REPEATABLE_QUEST)!;
    upsertQuestProgress({
      sessionId: session.sessionId,
      questId: REPEATABLE_QUEST,
      status: "completed",
      progress: current.progress,
      acceptedAt: current.acceptedAt,
      completedAt: pastTime
    });

    const scoped = scopedNpcId(session.sessionId, "baili");
    const result = evaluateIntent(session.sessionId, scoped, {
      type: "give_quest",
      params: { quest_id: REPEATABLE_QUEST }
    });

    expect(result.statusChanges).toContainEqual({
      questId: REPEATABLE_QUEST,
      from: "available",
      to: "accepted"
    });
    const progress = getQuestProgress(session.sessionId, REPEATABLE_QUEST);
    expect(progress?.status).toBe("accepted");
  });

  it("resets progress flags on re-acceptance", () => {
    const session = createSession();
    acceptAndComplete(session.sessionId);

    // Backdate to clear cooldown
    const pastTime = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();
    const current = getQuestProgress(session.sessionId, REPEATABLE_QUEST)!;
    upsertQuestProgress({
      sessionId: session.sessionId,
      questId: REPEATABLE_QUEST,
      status: "completed",
      progress: current.progress,
      acceptedAt: current.acceptedAt,
      completedAt: pastTime
    });

    const scoped = scopedNpcId(session.sessionId, "baili");
    evaluateIntent(session.sessionId, scoped, {
      type: "give_quest",
      params: { quest_id: REPEATABLE_QUEST }
    });

    // Progress flags should be cleared after re-acceptance
    const progress = getQuestProgress(session.sessionId, REPEATABLE_QUEST);
    expect(progress?.progress.delivery_done).toBeUndefined();
  });

  it("can be completed twice for repeated rewards", () => {
    const session = createSession();
    const before = getPlayer(session.sessionId)?.spiritStones ?? 0;

    // First completion
    acceptAndComplete(session.sessionId);

    // Backdate to clear cooldown
    const pastTime = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();
    const current = getQuestProgress(session.sessionId, REPEATABLE_QUEST)!;
    upsertQuestProgress({
      sessionId: session.sessionId,
      questId: REPEATABLE_QUEST,
      status: "completed",
      progress: current.progress,
      acceptedAt: current.acceptedAt,
      completedAt: pastTime
    });

    // Second completion
    acceptAndComplete(session.sessionId);

    const after = getPlayer(session.sessionId)?.spiritStones ?? 0;
    expect(after).toBe(before + 70); // 35 x 2
  });

  it("keeps non-repeatable quests closed after completion", () => {
    const session = createSession();
    const scoped = scopedNpcId(session.sessionId, "baili");

    // steal_inspector_key is non-repeatable; force it to completed
    upsertQuestProgress({
      sessionId: session.sessionId,
      questId: "steal_inspector_key",
      status: "completed",
      progress: {},
      acceptedAt: new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString()
    });

    const result = evaluateIntent(session.sessionId, scoped, {
      type: "give_quest",
      params: { quest_id: "steal_inspector_key" }
    });

    expect(result.statusChanges).toEqual([]);
    const progress = getQuestProgress(session.sessionId, "steal_inspector_key");
    expect(progress?.status).toBe("completed");
  });
});
