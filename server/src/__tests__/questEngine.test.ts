import { beforeEach, describe, expect, it } from "vitest";
import { applyStateDelta, resetGameState } from "../services/gameState.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";
import { clearRelationsForTests, getRelation } from "../services/npcRelationsStore.js";
import { clearSessionsForTests, createSession, getPlayer } from "../services/playerStore.js";
import { evaluateIntent, getRelevantQuests, markQuestFlag, QuestStateError } from "../services/questEngine.js";
import { clearQuestProgressForTests, getQuestProgress } from "../services/questStore.js";
import { scopedNpcId } from "../services/scopedNpcId.js";
import { clearInventoryForTests, getInventory } from "../services/inventoryStore.js";

describe("questEngine", () => {
  beforeEach(() => {
    clearQuestProgressForTests();
    clearRelationsForTests();
    clearAllMemoriesForTests();
    clearInventoryForTests();
    clearSessionsForTests();
    resetGameState();
  });

  it("transitions available → accepted when giver issues acceptable intent", () => {
    const session = createSession();
    const scoped = scopedNpcId(session.sessionId, "baili");

    const result = evaluateIntent(session.sessionId, scoped, {
      type: "give_quest",
      params: { quest_id: "steal_inspector_key" }
    });

    expect(result.statusChanges).toContainEqual({
      questId: "steal_inspector_key",
      from: "available",
      to: "accepted"
    });

    const stored = getQuestProgress(session.sessionId, "steal_inspector_key");
    expect(stored?.status).toBe("accepted");
    expect(stored?.acceptedAt).not.toBeNull();
  });

  it("ignores give_quest when issued by non-giver NPC", () => {
    const session = createSession();
    const scoped = scopedNpcId(session.sessionId, "suhe");

    const result = evaluateIntent(session.sessionId, scoped, {
      type: "give_quest",
      params: { quest_id: "steal_inspector_key" }
    });

    expect(result.statusChanges).toEqual([]);
    expect(getQuestProgress(session.sessionId, "steal_inspector_key")).toBeNull();
  });

  it("applies effectsOnAccept when transitioning to accepted", () => {
    const session = createSession();
    const scoped = scopedNpcId(session.sessionId, "qinggu");

    const result = evaluateIntent(session.sessionId, scoped, {
      type: "give_quest",
      params: { quest_id: "verify_suhe_identity" }
    });

    expect(result.effectsApplied.some((e) => e.kind === "set_flag" && e.key === "qinggu_intel_tipped")).toBe(true);
    const stored = getQuestProgress(session.sessionId, "verify_suhe_identity");
    expect(stored?.progress.qinggu_intel_tipped).toBe(true);
  });

  it("transitions accepted → in_progress on next intent", () => {
    const session = createSession();
    const scopedQinggu = scopedNpcId(session.sessionId, "qinggu");

    evaluateIntent(session.sessionId, scopedQinggu, {
      type: "give_quest",
      params: { quest_id: "verify_suhe_identity" }
    });

    const followup = evaluateIntent(session.sessionId, scopedQinggu, {
      type: "none",
      params: {}
    });

    expect(followup.statusChanges).toContainEqual({
      questId: "verify_suhe_identity",
      from: "accepted",
      to: "in_progress"
    });
    expect(getQuestProgress(session.sessionId, "verify_suhe_identity")?.status).toBe("in_progress");
  });

  it("completes quest when npc_state_threshold trigger matches", () => {
    const session = createSession();
    const scopedQinggu = scopedNpcId(session.sessionId, "qinggu");

    evaluateIntent(session.sessionId, scopedQinggu, {
      type: "give_quest",
      params: { quest_id: "verify_suhe_identity" }
    });

    applyStateDelta(scopedNpcId(session.sessionId, "suhe"), { trust: 0, fear: 0, anger: 60, tianDaoAlert: 0 });

    const result = evaluateIntent(session.sessionId, scopedNpcId(session.sessionId, "suhe"), {
      type: "none",
      params: {}
    });

    expect(result.statusChanges.some((c) => c.questId === "verify_suhe_identity" && c.to === "completed")).toBe(true);
    expect(getQuestProgress(session.sessionId, "verify_suhe_identity")?.status).toBe("completed");

    const player = getPlayer(session.sessionId);
    expect(player?.spiritStones).toBe(30);

    const relation = getRelation(session.sessionId, "qinggu", "suhe");
    expect(relation?.hostility).toBeGreaterThan(0);
  });

  it("fails quest when failure trigger matches before completion", () => {
    const session = createSession();
    const scopedChimu = scopedNpcId(session.sessionId, "chimu");

    evaluateIntent(session.sessionId, scopedChimu, {
      type: "give_quest",
      params: { quest_id: "pay_thunder_toll" }
    });

    applyStateDelta(scopedChimu, { trust: 0, fear: 0, anger: 85, tianDaoAlert: 0 });

    const result = evaluateIntent(session.sessionId, scopedChimu, {
      type: "none",
      params: {}
    });

    expect(result.statusChanges.some((c) => c.questId === "pay_thunder_toll" && c.to === "failed")).toBe(true);
    expect(getQuestProgress(session.sessionId, "pay_thunder_toll")?.status).toBe("failed");
  });

  it("does not modify terminal quests", () => {
    const session = createSession();
    const scopedBaili = scopedNpcId(session.sessionId, "baili");

    evaluateIntent(session.sessionId, scopedBaili, {
      type: "give_quest",
      params: { quest_id: "steal_inspector_key" }
    });
    markQuestFlag(session.sessionId, "steal_inspector_key", "inspector_key_obtained", true);

    const completed = evaluateIntent(session.sessionId, scopedBaili, {
      type: "none",
      params: {}
    });

    expect(completed.statusChanges.some((c) => c.to === "completed")).toBe(true);
    expect(getQuestProgress(session.sessionId, "steal_inspector_key")?.status).toBe("completed");

    const inventoryAfterCompletion = getInventory(session.sessionId);
    const cloudVeilCount = inventoryAfterCompletion.find((i) => i.itemId === "cloud_veil_pill")?.quantity ?? 0;

    const again = evaluateIntent(session.sessionId, scopedBaili, {
      type: "give_quest",
      params: { quest_id: "steal_inspector_key" }
    });

    expect(again.statusChanges).toEqual([]);
    expect(again.effectsApplied).toEqual([]);
    const inventoryAfterReevaluation = getInventory(session.sessionId);
    expect(inventoryAfterReevaluation.find((i) => i.itemId === "cloud_veil_pill")?.quantity ?? 0).toBe(cloudVeilCount);
  });

  it("markQuestFlag throws when quest is unknown or terminal", () => {
    const session = createSession();

    expect(() => markQuestFlag(session.sessionId, "no_such_quest", "x", true)).toThrow(QuestStateError);

    evaluateIntent(session.sessionId, scopedNpcId(session.sessionId, "baili"), {
      type: "give_quest",
      params: { quest_id: "steal_inspector_key" }
    });
    markQuestFlag(session.sessionId, "steal_inspector_key", "inspector_key_obtained", true);
    evaluateIntent(session.sessionId, scopedNpcId(session.sessionId, "baili"), {
      type: "none",
      params: {}
    });

    expect(() => markQuestFlag(session.sessionId, "steal_inspector_key", "more", true)).toThrow(QuestStateError);
  });

  it("getRelevantQuests filters by giverNpcId or involvedNpcIds", () => {
    const session = createSession();
    evaluateIntent(session.sessionId, scopedNpcId(session.sessionId, "baili"), {
      type: "give_quest",
      params: { quest_id: "steal_inspector_key" }
    });

    const forBaili = getRelevantQuests(session.sessionId, "baili");
    const forSuhe = getRelevantQuests(session.sessionId, "suhe");
    const forChimu = getRelevantQuests(session.sessionId, "chimu");

    expect(forBaili.map((q) => q.questId)).toContain("steal_inspector_key");
    expect(forSuhe.map((q) => q.questId)).toContain("steal_inspector_key");
    expect(forChimu.map((q) => q.questId)).not.toContain("steal_inspector_key");
  });
});
