import { describe, expect, it } from "vitest";
import {
  computeNextAvailableAt,
  evaluateRepeatableAvailability
} from "../services/questCooldown.js";
import type { QuestDefinition, QuestProgress } from "../types/quest.js";

function makeDefinition(overrides: Partial<QuestDefinition> = {}): QuestDefinition {
  return {
    questId: "test_quest",
    title: "测试委托",
    description: "测试用",
    giverNpcId: "baili",
    involvedNpcIds: ["baili"],
    acceptableViaIntent: "give_quest",
    completionTriggers: [],
    failureTriggers: [],
    effectsOnAccept: [],
    effectsOnComplete: [],
    effectsOnFail: [],
    ...overrides
  };
}

function makeProgress(overrides: Partial<QuestProgress> = {}): QuestProgress {
  return {
    sessionId: "s1",
    questId: "test_quest",
    status: "completed",
    progress: {},
    acceptedAt: "2026-05-30T00:00:00.000Z",
    completedAt: "2026-05-30T00:00:00.000Z",
    updatedAt: "2026-05-30T00:00:00.000Z",
    ...overrides
  };
}

describe("questCooldown.evaluateRepeatableAvailability", () => {
  it("allows acceptance when no prior progress exists", () => {
    const result = evaluateRepeatableAvailability(makeDefinition({ repeatable: true }), null);
    expect(result.canAccept).toBe(true);
  });

  it("allows acceptance for non-terminal status", () => {
    const result = evaluateRepeatableAvailability(
      makeDefinition({ repeatable: true }),
      makeProgress({ status: "in_progress" })
    );
    expect(result.canAccept).toBe(true);
  });

  it("blocks re-acceptance of a non-repeatable completed quest", () => {
    const result = evaluateRepeatableAvailability(
      makeDefinition({ repeatable: false }),
      makeProgress({ status: "completed" })
    );
    expect(result.canAccept).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("blocks re-acceptance during cooldown", () => {
    const completedAt = new Date("2026-05-30T00:00:00.000Z");
    const now = new Date("2026-05-30T10:00:00.000Z"); // 10h later, cooldown 48h
    const result = evaluateRepeatableAvailability(
      makeDefinition({ repeatable: true, cooldownHours: 48 }),
      makeProgress({ status: "completed", completedAt: completedAt.toISOString() }),
      now
    );
    expect(result.canAccept).toBe(false);
    expect(result.availableAt).toBeTruthy();
  });

  it("allows re-acceptance after cooldown elapses", () => {
    const completedAt = new Date("2026-05-30T00:00:00.000Z");
    const now = new Date("2026-06-01T01:00:00.000Z"); // 49h later, cooldown 48h
    const result = evaluateRepeatableAvailability(
      makeDefinition({ repeatable: true, cooldownHours: 48 }),
      makeProgress({ status: "completed", completedAt: completedAt.toISOString() }),
      now
    );
    expect(result.canAccept).toBe(true);
  });

  it("allows immediate retry of a failed repeatable quest", () => {
    const result = evaluateRepeatableAvailability(
      makeDefinition({ repeatable: true }),
      makeProgress({ status: "failed", completedAt: "2026-05-30T00:00:00.000Z" })
    );
    expect(result.canAccept).toBe(true);
  });

  it("uses default 48h cooldown when not specified", () => {
    const completedAt = new Date("2026-05-30T00:00:00.000Z");
    const now = new Date("2026-05-31T00:00:00.000Z"); // 24h later
    const result = evaluateRepeatableAvailability(
      makeDefinition({ repeatable: true }),
      makeProgress({ status: "completed", completedAt: completedAt.toISOString() }),
      now
    );
    expect(result.canAccept).toBe(false);
  });
});

describe("questCooldown.computeNextAvailableAt", () => {
  it("returns null for non-repeatable quests", () => {
    const result = computeNextAvailableAt(
      makeDefinition({ repeatable: false }),
      makeProgress({ status: "completed" })
    );
    expect(result).toBeNull();
  });

  it("returns null when quest is not completed", () => {
    const result = computeNextAvailableAt(
      makeDefinition({ repeatable: true }),
      makeProgress({ status: "in_progress", completedAt: null })
    );
    expect(result).toBeNull();
  });

  it("computes correct next available time", () => {
    const result = computeNextAvailableAt(
      makeDefinition({ repeatable: true, cooldownHours: 48 }),
      makeProgress({ status: "completed", completedAt: "2026-05-30T00:00:00.000Z" })
    );
    expect(result).toBe("2026-06-01T00:00:00.000Z");
  });
});
