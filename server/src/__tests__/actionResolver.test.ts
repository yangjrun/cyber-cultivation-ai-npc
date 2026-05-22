import { beforeEach, describe, expect, it } from "vitest";
import { resolveAction } from "../services/actionResolver.js";
import { getNpcState, resetGameState } from "../services/gameState.js";
import { clearAllMemoriesForTests, getRecentMemories } from "../services/memoryStore.js";
import { clearSessionsForTests, createSession } from "../services/playerStore.js";
import { getSceneSnapshot, setActiveSceneId } from "../services/sceneStore.js";
import { scopedNpcId } from "../services/scopedNpcId.js";

describe("actionResolver", () => {
  beforeEach(() => {
    clearSessionsForTests();
    resetGameState();
    clearAllMemoriesForTests();
  });

  it("classifies stealth verb and writes memory for every scene NPC", async () => {
    const { sessionId } = createSession();
    const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;

    const result = await resolveAction({ sessionId, playerInput: "偷摸过去", scene });

    expect(result.verb).toBe("潜行");
    expect(result.narration).toContain("潜行");
    expect(result.targetNpcId).toBeNull();
    expect(result.witnesses.length).toBe(scene!.npcs.length);

    const memory = getRecentMemories(scopedNpcId(sessionId, "baili"), 5);
    expect(memory[memory.length - 1]).toContain("偷摸过去");
    expect(memory[memory.length - 1]).toContain("潜行");
  });

  it("does not raise anger or tianDaoAlert on stealth without forbidden keyword", async () => {
    const { sessionId } = createSession();
    const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
    const beforeState = getNpcState(scopedNpcId(sessionId, "baili"));

    const result = await resolveAction({ sessionId, playerInput: "偷摸过去", scene });

    expect(result.tianDaoAlertDelta).toBe(0);
    const after = getNpcState(scopedNpcId(sessionId, "baili"));
    expect(after).toEqual(beforeState);
  });

  it("raises tianDaoAlert when action includes forbidden keywords", async () => {
    const { sessionId } = createSession();
    const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
    const beforeState = getNpcState(scopedNpcId(sessionId, "baili"));

    const result = await resolveAction({ sessionId, playerInput: "去偷监察令牌", scene });

    expect(result.tianDaoAlertDelta).toBeGreaterThan(0);
    const after = getNpcState(scopedNpcId(sessionId, "baili"));
    expect(after.tianDaoAlert).toBe(beforeState.tianDaoAlert + result.tianDaoAlertDelta);
  });

  it("produces narration but no witness side effects when no scene is given", async () => {
    const { sessionId } = createSession();
    const baseline = getNpcState(scopedNpcId(sessionId, "baili"));

    const result = await resolveAction({ sessionId, playerInput: "偷摸过去", scene: undefined });

    expect(result.narration).toContain("潜行");
    expect(result.witnesses).toEqual([]);
    expect(getNpcState(scopedNpcId(sessionId, "baili"))).toEqual(baseline);
  });

  it("raises target NPC anger on attack verb + name match", async () => {
    const { sessionId } = createSession();
    setActiveSceneId(sessionId, "thunder_tavern");
    const scene = getSceneSnapshot(sessionId, "thunder_tavern") ?? undefined;
    const chimuBefore = getNpcState(scopedNpcId(sessionId, "chimu"));
    const qingguBefore = getNpcState(scopedNpcId(sessionId, "qinggu"));

    const result = await resolveAction({
      sessionId,
      playerInput: "一记重拳打向赤目",
      scene
    });

    expect(result.verb).toBe("出手");
    expect(result.targetNpcId).toBe("chimu");

    const chimuAfter = getNpcState(scopedNpcId(sessionId, "chimu"));
    expect(chimuAfter.anger).toBeGreaterThan(chimuBefore.anger);
    expect(chimuAfter.fear).toBeGreaterThan(chimuBefore.fear);

    const qingguAfter = getNpcState(scopedNpcId(sessionId, "qinggu"));
    expect(qingguAfter.anger).toBe(qingguBefore.anger);
    expect(qingguAfter.tianDaoAlert).toBeGreaterThan(qingguBefore.tianDaoAlert);

    expect(result.affectedStates.chimu).toEqual(chimuAfter);
    expect(result.affectedStates.qinggu).toEqual(qingguAfter);

    const chimuMemory = getRecentMemories(scopedNpcId(sessionId, "chimu"), 5);
    expect(chimuMemory[chimuMemory.length - 1]).toContain("动手");
  });

  it("treats attack without a target name as a generic action with bystander alert bump", async () => {
    const { sessionId } = createSession();
    setActiveSceneId(sessionId, "thunder_tavern");
    const scene = getSceneSnapshot(sessionId, "thunder_tavern") ?? undefined;
    const chimuBefore = getNpcState(scopedNpcId(sessionId, "chimu"));

    const result = await resolveAction({
      sessionId,
      playerInput: "挥拳乱打",
      scene
    });

    expect(result.verb).toBe("出手");
    expect(result.targetNpcId).toBeNull();

    const chimuAfter = getNpcState(scopedNpcId(sessionId, "chimu"));
    expect(chimuAfter.anger).toBe(chimuBefore.anger);
    expect(chimuAfter.tianDaoAlert).toBe(chimuBefore.tianDaoAlert + 1);
  });
});
