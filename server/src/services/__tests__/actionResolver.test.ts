import { beforeEach, describe, expect, it } from "vitest";
import { resolveAction } from "../actionResolver.js";
import { clearSessionsForTests, createSession } from "../playerStore.js";
import { resetGameState, getNpcState } from "../gameState.js";
import { getSceneSnapshot } from "../sceneStore.js";
import { clearAllMemoriesForTests, getRecentMemories } from "../memoryStore.js";

describe("actionResolver", () => {
  let sessionId: string;

  beforeEach(() => {
    clearSessionsForTests();
    resetGameState();
    clearAllMemoriesForTests();
    const session = createSession();
    sessionId = session.sessionId;
  });

  describe("verb classification", () => {
    it("classifies stealth actions", async () => {
      const result = await resolveAction({
        sessionId,
        playerInput: "偷偷溜进去",
        scene: undefined
      });

      expect(result.verb).toBe("潜行");
    });

    it("classifies attack actions", async () => {
      const result = await resolveAction({
        sessionId,
        playerInput: "一拳打向他",
        scene: undefined
      });

      expect(result.verb).toBe("出手");
    });

    it("classifies flee actions", async () => {
      const result = await resolveAction({
        sessionId,
        playerInput: "快速逃离现场",
        scene: undefined
      });

      expect(result.verb).toBe("撤离");
    });

    it("classifies search actions", async () => {
      const result = await resolveAction({
        sessionId,
        playerInput: "翻找抽屉",
        scene: undefined
      });

      expect(result.verb).toBe("搜查");
    });

    it("defaults to generic action verb", async () => {
      const result = await resolveAction({
        sessionId,
        playerInput: "站在原地",
        scene: undefined
      });

      expect(result.verb).toBe("动作");
    });
  });

  describe("target detection", () => {
    it("identifies target NPC by name in attack", async () => {
      const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
      const result = await resolveAction({
        sessionId,
        playerInput: "一拳打向白璃",
        scene
      });

      expect(result.verb).toBe("出手");
      expect(result.targetNpcId).toBe("baili");
    });

    it("returns null target for non-attack actions", async () => {
      const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
      const result = await resolveAction({
        sessionId,
        playerInput: "偷偷靠近白璃",
        scene
      });

      expect(result.verb).toBe("潜行");
      expect(result.targetNpcId).toBeNull();
    });

    it("returns null target when no NPC name mentioned", async () => {
      const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
      const result = await resolveAction({
        sessionId,
        playerInput: "挥拳",
        scene
      });

      expect(result.verb).toBe("出手");
      expect(result.targetNpcId).toBeNull();
    });
  });

  describe("state changes", () => {
    it("increases target anger and fear on attack", async () => {
      const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
      const bailiBefore = getNpcState(`${sessionId}::baili`);

      const result = await resolveAction({
        sessionId,
        playerInput: "一拳打向白璃",
        scene
      });

      expect(result.affectedStates.baili).toBeDefined();
      expect(result.affectedStates.baili.anger).toBe(bailiBefore.anger + 8);
      expect(result.affectedStates.baili.fear).toBe(bailiBefore.fear + 2);

      const bailiAfter = getNpcState(`${sessionId}::baili`);
      expect(bailiAfter.anger).toBeGreaterThan(bailiBefore.anger);
      expect(bailiAfter.fear).toBeGreaterThan(bailiBefore.fear);
    });

    it("increases bystander tianDaoAlert on attack", async () => {
      const scene = getSceneSnapshot(sessionId, "thunder_tavern") ?? undefined;
      const qingguBefore = getNpcState(`${sessionId}::qinggu`);

      await resolveAction({
        sessionId,
        playerInput: "一拳打向赤目",
        scene
      });

      const qingguAfter = getNpcState(`${sessionId}::qinggu`);
      expect(qingguAfter.tianDaoAlert).toBeGreaterThan(qingguBefore.tianDaoAlert);
    });

    it("increases tianDaoAlert for all NPCs when forbidden keywords present", async () => {
      const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
      const bailiBefore = getNpcState(`${sessionId}::baili`);

      const result = await resolveAction({
        sessionId,
        playerInput: "我有非法芯片",
        scene
      });

      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.tianDaoAlertDelta).toBeGreaterThan(0);

      const bailiAfter = getNpcState(`${sessionId}::baili`);
      expect(bailiAfter.tianDaoAlert).toBeGreaterThan(bailiBefore.tianDaoAlert);
    });
  });

  describe("memory recording", () => {
    it("records target-specific memory for attack victim", async () => {
      const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;

      await resolveAction({
        sessionId,
        playerInput: "一拳打向白璃",
        scene
      });

      const memories = getRecentMemories(`${sessionId}::baili`, 5);
      expect(memories.some((m) => m.includes("玩家对白璃动手了"))).toBe(true);
    });

    it("records witness memory for bystanders", async () => {
      const scene = getSceneSnapshot(sessionId, "thunder_tavern") ?? undefined;

      await resolveAction({
        sessionId,
        playerInput: "一拳打向赤目",
        scene
      });

      const qingguMemories = getRecentMemories(`${sessionId}::qinggu`, 5);
      expect(qingguMemories.some((m) => m.includes("玩家出手"))).toBe(true);
    });

    it("records action memory for all NPCs in scene", async () => {
      const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;

      await resolveAction({
        sessionId,
        playerInput: "偷偷溜走",
        scene
      });

      const memories = getRecentMemories(`${sessionId}::baili`, 5);
      expect(memories.some((m) => m.includes("玩家潜行"))).toBe(true);
    });
  });

  describe("witness list", () => {
    it("includes all NPCs in scene as witnesses", async () => {
      const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;

      const result = await resolveAction({
        sessionId,
        playerInput: "四处张望",
        scene
      });

      expect(result.witnesses.length).toBe(scene?.npcs.length ?? 0);
      expect(result.witnesses.every((w) => w.npcId && w.memory && w.state)).toBe(true);
    });

    it("includes state deltas in witness records", async () => {
      const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;

      const result = await resolveAction({
        sessionId,
        playerInput: "一拳打向白璃",
        scene
      });

      const targetWitness = result.witnesses.find((w) => w.npcId === "baili");
      expect(targetWitness?.angerDelta).toBe(8);
      expect(targetWitness?.fearDelta).toBe(2);
    });
  });

  describe("no scene scenario", () => {
    it("resolves action without scene context", async () => {
      const result = await resolveAction({
        sessionId,
        playerInput: "站在原地思考",
        scene: undefined
      });

      expect(result.verb).toBe("动作");
      expect(result.witnesses).toHaveLength(0);
      expect(result.affectedStates).toEqual({});
      expect(result.targetNpcId).toBeNull();
    });
  });
});
