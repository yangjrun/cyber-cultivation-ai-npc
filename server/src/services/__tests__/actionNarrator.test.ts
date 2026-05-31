import { beforeEach, describe, expect, it } from "vitest";
import { generateActionNarration } from "../actionNarrator.js";
import { clearSessionsForTests, createSession } from "../playerStore.js";
import { getSceneSnapshot } from "../sceneStore.js";
import type { ActionWitness } from "../actionResolver.js";
import type { PlayerState } from "../../types/player.js";

describe("actionNarrator", () => {
  let sessionId: string;
  let player: PlayerState;

  beforeEach(() => {
    clearSessionsForTests();
    const session = createSession();
    sessionId = session.sessionId;
    player = session.player;
  });

  it("generates narration for stealth action with target", async () => {
    const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
    const witnesses: ActionWitness[] = scene
      ? scene.npcs.map((npc) => ({
          npcId: npc.profile.npc_id,
          tianDaoAlertDelta: 0,
          angerDelta: 0,
          fearDelta: 0,
          memory: "玩家潜行",
          state: npc.state
        }))
      : [];

    const result = await generateActionNarration({
      sessionId,
      playerInput: "偷偷摸一下 白璃 大腿",
      actionVerb: "潜行",
      targetNpcId: "baili",
      scene,
      witnesses,
      player
    });

    expect(result.narration).toBeTruthy();
    expect(typeof result.narration).toBe("string");
    expect(result.narration.length).toBeGreaterThan(10);

    // In mock mode, mockFallback returns the improved fallback string
    if (!process.env.LLM_API_KEY) {
      expect(result.narration).toBe("偷偷摸一下 白璃 大腿——悄无声息。");
    }
  });

  it("generates narration for attack action", async () => {
    const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
    const witnesses: ActionWitness[] = [
      {
        npcId: "baili",
        tianDaoAlertDelta: 0,
        angerDelta: 8,
        fearDelta: 2,
        memory: "玩家动手了",
        state: { trust: 20, fear: 12, anger: 8, tianDaoAlert: 45 }
      }
    ];

    const result = await generateActionNarration({
      sessionId,
      playerInput: "一拳打向 白璃",
      actionVerb: "出手",
      targetNpcId: "baili",
      scene,
      witnesses,
      player
    });

    expect(result.narration).toBeTruthy();
    expect(typeof result.narration).toBe("string");

    if (!process.env.LLM_API_KEY) {
      expect(result.narration).toBe("一拳打向 白璃——迅如闪电。");
    }
  });

  it("generates narration for action without scene", async () => {
    const result = await generateActionNarration({
      sessionId,
      playerInput: "练习剑法",
      actionVerb: "动作",
      targetNpcId: null,
      scene: undefined,
      witnesses: [],
      player
    });

    expect(result.narration).toBeTruthy();
    expect(typeof result.narration).toBe("string");

    if (!process.env.LLM_API_KEY) {
      expect(result.fallbackUsed).toBe(true);
      expect(result.narration).toBe("练习剑法");
    }
  });

  it("generates narration for flee action", async () => {
    const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
    const witnesses: ActionWitness[] = scene
      ? scene.npcs.map((npc) => ({
          npcId: npc.profile.npc_id,
          tianDaoAlertDelta: 1,
          angerDelta: 0,
          fearDelta: 0,
          memory: "玩家逃跑",
          state: { ...npc.state, tianDaoAlert: npc.state.tianDaoAlert + 1 }
        }))
      : [];

    const result = await generateActionNarration({
      sessionId,
      playerInput: "快速逃离现场",
      actionVerb: "撤离",
      targetNpcId: null,
      scene,
      witnesses,
      player
    });

    expect(result.narration).toBeTruthy();
    expect(typeof result.narration).toBe("string");

    if (!process.env.LLM_API_KEY) {
      expect(result.narration).toBe("快速逃离现场——迅速离开。");
    }
  });

  it("generates narration for search action", async () => {
    const result = await generateActionNarration({
      sessionId,
      playerInput: "翻找房间里的宝箱",
      actionVerb: "搜查",
      targetNpcId: null,
      scene: undefined,
      witnesses: [],
      player
    });

    expect(result.narration).toBeTruthy();
    expect(typeof result.narration).toBe("string");

    if (!process.env.LLM_API_KEY) {
      expect(result.narration).toBe("翻找房间里的宝箱——仔细搜寻。");
    }
  });

  it("uses fallback narration format", async () => {
    const result = await generateActionNarration({
      sessionId,
      playerInput: "测试动作",
      actionVerb: "动作",
      targetNpcId: null,
      scene: undefined,
      witnesses: [],
      player
    });

    // In mock mode without LLM, mockFallback returns improved fallback format
    if (!process.env.LLM_API_KEY) {
      expect(result.narration).toBe("测试动作");
    }
  });
});
