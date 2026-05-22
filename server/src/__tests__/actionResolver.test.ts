import { beforeEach, describe, expect, it } from "vitest";
import { resolveAction } from "../services/actionResolver.js";
import { getNpcState, resetGameState } from "../services/gameState.js";
import { clearAllMemoriesForTests, getRecentMemories } from "../services/memoryStore.js";
import { clearSessionsForTests, createSession } from "../services/playerStore.js";
import { getSceneSnapshot } from "../services/sceneStore.js";
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

    expect(result.narration).toContain("潜行");
    expect(result.witnesses.length).toBe(scene!.npcs.length);

    const memory = getRecentMemories(scopedNpcId(sessionId, "baili"), 5);
    expect(memory[memory.length - 1]).toContain("偷摸过去");
    expect(memory[memory.length - 1]).toContain("潜行");
  });

  it("does not raise tianDaoAlert when no forbidden keyword appears", async () => {
    const { sessionId } = createSession();
    const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
    const beforeState = getNpcState(scopedNpcId(sessionId, "baili"));

    const result = await resolveAction({ sessionId, playerInput: "偷摸过去", scene });

    expect(result.tianDaoAlertDelta).toBe(0);
    expect(getNpcState(scopedNpcId(sessionId, "baili")).tianDaoAlert).toBe(beforeState.tianDaoAlert);
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
});
