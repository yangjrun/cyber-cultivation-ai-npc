import { beforeEach, describe, expect, it } from "vitest";
import { resetGameState } from "../services/gameState.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";
import { clearRelationsForTests } from "../services/npcRelationsStore.js";
import {
  clearPersonalityForTests,
  deriveEvents,
  evaluateRules,
  getPersonality,
  recordEvents,
  resetPersonality
} from "../services/personalityEvolution.js";
import { clearSessionsForTests, createSession } from "../services/playerStore.js";
import { clearQuestProgressForTests } from "../services/questStore.js";
import { clearInventoryForTests } from "../services/inventoryStore.js";

describe("personalityEvolution", () => {
  beforeEach(() => {
    clearQuestProgressForTests();
    clearRelationsForTests();
    clearAllMemoriesForTests();
    clearInventoryForTests();
    clearPersonalityForTests();
    clearSessionsForTests();
    resetGameState();
  });

  it("returns empty record for unseen NPC", () => {
    const session = createSession();
    const record = getPersonality(session.sessionId, "baili");

    expect(record.evolvedTraits).toEqual([]);
    expect(record.counters).toEqual({});
  });

  it("recordEvents accumulates counters across calls", () => {
    const session = createSession();

    recordEvents(session.sessionId, "baili", ["threat", "threat"]);
    recordEvents(session.sessionId, "baili", ["threat", "report"]);

    const record = getPersonality(session.sessionId, "baili");
    expect(record.counters.threats).toBe(3);
    expect(record.counters.reports).toBe(1);
  });

  it("evaluateRules adds trait once threshold reached", () => {
    const session = createSession();

    for (let i = 0; i < 5; i += 1) {
      recordEvents(session.sessionId, "baili", ["threat"]);
    }
    const after = evaluateRules(session.sessionId, "baili");

    expect(after.evolvedTraits).toContain("对玩家保持警觉，开炉前会多扫一眼。");
  });

  it("evaluateRules does not duplicate once-only traits", () => {
    const session = createSession();

    for (let i = 0; i < 6; i += 1) {
      recordEvents(session.sessionId, "baili", ["threat"]);
    }

    const first = evaluateRules(session.sessionId, "baili");
    const second = evaluateRules(session.sessionId, "baili");

    expect(first.evolvedTraits).toEqual(second.evolvedTraits);
    expect(second.evolvedTraits.filter((t) => t.includes("警觉"))).toHaveLength(1);
  });

  it("evaluateRules respects per-NPC scope", () => {
    const session = createSession();

    for (let i = 0; i < 8; i += 1) {
      recordEvents(session.sessionId, "suhe", ["query"]);
    }
    const suhe = evaluateRules(session.sessionId, "suhe");
    const baili = evaluateRules(session.sessionId, "baili");

    expect(suhe.evolvedTraits.some((t) => t.includes("观察对象"))).toBe(true);
    expect(baili.evolvedTraits).toEqual([]);
  });

  it("resetPersonality clears traits and counters", () => {
    const session = createSession();

    for (let i = 0; i < 5; i += 1) {
      recordEvents(session.sessionId, "baili", ["threat"]);
    }
    evaluateRules(session.sessionId, "baili");
    resetPersonality(session.sessionId, "baili");

    const after = getPersonality(session.sessionId, "baili");
    expect(after.evolvedTraits).toEqual([]);
    expect(after.counters).toEqual({});
  });

  it("deriveEvents maps intent + state_delta + quest changes to events", () => {
    const events = deriveEvents(
      { type: "refuse_service", params: {} },
      { trust: 0, fear: 0, anger: 8, tianDaoAlert: 0 },
      [{ questId: "x", from: "in_progress", to: "failed" }]
    );

    expect(events).toContain("refused_trade");
    expect(events).toContain("threat");
    expect(events).toContain("quest_failed");
  });

  it("deriveEvents emits successful_trade and gift signals", () => {
    const events = deriveEvents(
      { type: "complete_trade", params: {} },
      { trust: 6, fear: 0, anger: 0, tianDaoAlert: 0 },
      []
    );

    expect(events).toContain("successful_trade");
    expect(events).toContain("gift");
  });

  it("qinggu requires multiple traits across two rules", () => {
    const session = createSession();

    for (let i = 0; i < 2; i += 1) {
      recordEvents(session.sessionId, "qinggu", ["successful_trade"]);
    }
    for (let i = 0; i < 2; i += 1) {
      recordEvents(session.sessionId, "qinggu", ["report"]);
    }
    const after = evaluateRules(session.sessionId, "qinggu");

    expect(after.evolvedTraits.length).toBeGreaterThanOrEqual(2);
  });
});
