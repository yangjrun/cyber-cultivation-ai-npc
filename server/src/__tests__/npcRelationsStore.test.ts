import { beforeEach, describe, expect, it } from "vitest";
import { initialNpcRelations } from "../data/npcInitialRelations.js";
import { applyRelationDelta, clearRelationsForTests, getAllRelationsForSession, getRelation, initializeRelationsForSession } from "../services/npcRelationsStore.js";
import { clearSessionsForTests, createSession } from "../services/playerStore.js";

describe("npcRelationsStore", () => {
  beforeEach(() => {
    clearRelationsForTests();
    clearSessionsForTests();
  });

  it("createSession seeds the full initial relation matrix", () => {
    const session = createSession();
    const relations = getAllRelationsForSession(session.sessionId);

    expect(relations.length).toBe(initialNpcRelations.length);
    const baili2qinggu = getRelation(session.sessionId, "baili", "qinggu");
    expect(baili2qinggu).toMatchObject({ trust: 10, hostility: 0 });
  });

  it("initializeRelationsForSession is idempotent", () => {
    const session = createSession();
    const baseline = getAllRelationsForSession(session.sessionId).length;

    initializeRelationsForSession(session.sessionId);

    expect(getAllRelationsForSession(session.sessionId).length).toBe(baseline);
  });

  it("applyRelationDelta updates and clamps", () => {
    const session = createSession();
    const result = applyRelationDelta(session.sessionId, "baili", "chimu", { trust: -200, hostility: 80 });

    expect(result.trust).toBe(-100);          // -5 + (-200), clamped to -100
    expect(result.hostility).toBe(100);       // 30 + 80 = 110, clamped to 100
  });

  it("relations are isolated by session", () => {
    const sessionA = createSession();
    const sessionB = createSession();

    applyRelationDelta(sessionA.sessionId, "baili", "suhe", { trust: 50 });

    const a = getRelation(sessionA.sessionId, "baili", "suhe");
    const b = getRelation(sessionB.sessionId, "baili", "suhe");

    expect(a?.trust).toBe(40);  // -10 + 50
    expect(b?.trust).toBe(-10); // untouched seed
  });
});
