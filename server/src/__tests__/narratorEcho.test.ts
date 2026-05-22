import { beforeEach, describe, expect, it } from "vitest";
import { echoMonologue } from "../services/narratorEcho.js";
import { getNpcState, resetGameState } from "../services/gameState.js";
import { clearAllMemoriesForTests, getRecentMemories } from "../services/memoryStore.js";
import { clearSessionsForTests, createSession } from "../services/playerStore.js";
import { getSceneSnapshot } from "../services/sceneStore.js";
import { scopedNpcId } from "../services/scopedNpcId.js";

describe("narratorEcho", () => {
  beforeEach(() => {
    clearSessionsForTests();
    resetGameState();
    clearAllMemoriesForTests();
  });

  it("returns playerInput as narration and produces no side effects for neutral input", async () => {
    const { sessionId } = createSession();
    const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
    const beforeState = getNpcState(scopedNpcId(sessionId, "baili"));

    const result = await echoMonologue({ sessionId, playerInput: "完蛋", scene });

    expect(result.narration).toBe("完蛋");
    expect(result.hits).toEqual([]);
    expect(result.tianDaoAlertDelta).toBe(0);
    expect(result.sideEffects).toEqual([]);
    expect(getNpcState(scopedNpcId(sessionId, "baili"))).toEqual(beforeState);
    expect(getRecentMemories(scopedNpcId(sessionId, "baili"), 5)).toEqual([]);
  });

  it("raises tianDaoAlert and writes memory for every scene NPC on forbidden keywords", async () => {
    const { sessionId } = createSession();
    const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
    const baseline = getNpcState(scopedNpcId(sessionId, "baili"));

    const result = await echoMonologue({ sessionId, playerInput: "我有非法芯片", scene });

    expect(result.hits.sort()).toEqual(["芯片", "非法"]);
    expect(result.tianDaoAlertDelta).toBeGreaterThan(0);
    expect(result.sideEffects.length).toBe(scene!.npcs.length);

    const after = getNpcState(scopedNpcId(sessionId, "baili"));
    expect(after.tianDaoAlert).toBe(baseline.tianDaoAlert + result.tianDaoAlertDelta);

    const memory = getRecentMemories(scopedNpcId(sessionId, "baili"), 5);
    expect(memory[memory.length - 1]).toContain("非法");
    expect(memory[memory.length - 1]).toContain("芯片");
  });

  it("does not write memory or change state when there is no scene", async () => {
    const { sessionId } = createSession();
    const baseline = getNpcState(scopedNpcId(sessionId, "baili"));

    const result = await echoMonologue({ sessionId, playerInput: "我有非法芯片", scene: undefined });

    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.sideEffects).toEqual([]);
    expect(getNpcState(scopedNpcId(sessionId, "baili"))).toEqual(baseline);
  });
});
