import { beforeEach, describe, expect, it } from "vitest";
import { clearSessionsForTests, createSession } from "../services/playerStore.js";
import { clearQuestProgressForTests, getAllQuestProgressForSession, getQuestProgress, upsertQuestProgress } from "../services/questStore.js";

describe("questStore", () => {
  beforeEach(() => {
    clearQuestProgressForTests();
    clearSessionsForTests();
  });

  it("returns null for missing quest", () => {
    const session = createSession();
    expect(getQuestProgress(session.sessionId, "steal_inspector_key")).toBeNull();
  });

  it("upserts new progress and round-trips via getQuestProgress", () => {
    const session = createSession();
    const acceptedAt = new Date().toISOString();
    const written = upsertQuestProgress({
      sessionId: session.sessionId,
      questId: "steal_inspector_key",
      status: "accepted",
      progress: { key_stolen: false },
      acceptedAt,
      completedAt: null
    });

    expect(written.questId).toBe("steal_inspector_key");
    expect(written.status).toBe("accepted");
    expect(written.progress).toEqual({ key_stolen: false });
    expect(written.acceptedAt).toBe(acceptedAt);
    expect(written.completedAt).toBeNull();

    const read = getQuestProgress(session.sessionId, "steal_inspector_key");
    expect(read).toEqual(written);
  });

  it("updates status + progress + completedAt on second upsert", () => {
    const session = createSession();
    const acceptedAt = new Date().toISOString();

    upsertQuestProgress({
      sessionId: session.sessionId,
      questId: "verify_suhe_identity",
      status: "accepted",
      progress: {},
      acceptedAt,
      completedAt: null
    });

    const completedAt = new Date().toISOString();
    const completed = upsertQuestProgress({
      sessionId: session.sessionId,
      questId: "verify_suhe_identity",
      status: "completed",
      progress: { suhe_revealed: true },
      acceptedAt,
      completedAt
    });

    expect(completed.status).toBe("completed");
    expect(completed.progress).toEqual({ suhe_revealed: true });
    expect(completed.completedAt).toBe(completedAt);
    // acceptedAt should be preserved via COALESCE
    expect(completed.acceptedAt).toBe(acceptedAt);
  });

  it("getAllQuestProgressForSession isolates per session", () => {
    const sessionA = createSession();
    const sessionB = createSession();

    upsertQuestProgress({
      sessionId: sessionA.sessionId,
      questId: "steal_inspector_key",
      status: "in_progress",
      progress: {},
      acceptedAt: null,
      completedAt: null
    });

    upsertQuestProgress({
      sessionId: sessionB.sessionId,
      questId: "pay_thunder_toll",
      status: "available",
      progress: {},
      acceptedAt: null,
      completedAt: null
    });

    const listA = getAllQuestProgressForSession(sessionA.sessionId);
    const listB = getAllQuestProgressForSession(sessionB.sessionId);

    expect(listA.map((q) => q.questId)).toEqual(["steal_inspector_key"]);
    expect(listB.map((q) => q.questId)).toEqual(["pay_thunder_toll"]);
  });
});
