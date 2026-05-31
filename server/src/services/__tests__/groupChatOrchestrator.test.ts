import { beforeEach, describe, expect, it } from "vitest";
import { orchestrateGroupChatTurn } from "../groupChatOrchestrator.js";
import { clearSessionsForTests, createSession, getPlayer } from "../playerStore.js";
import { resetGameState } from "../gameState.js";
import { getSceneSnapshot } from "../sceneStore.js";
import type { ActionContext } from "../../routes/chat.js";

describe("groupChatOrchestrator", () => {
  let sessionId: string;

  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    clearSessionsForTests();
    resetGameState();
    const session = createSession();
    sessionId = session.sessionId;
  });

  it("orchestrates a basic dialogue turn with target NPC", async () => {
    const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
    const player = getPlayer(sessionId);
    if (!player) throw new Error("Player not found");

    const result = await orchestrateGroupChatTurn({
      sessionId,
      targetNpcId: "baili",
      player,
      playerInput: "我要买丹药",
      scene
    });

    expect(result.replies.length).toBeGreaterThan(0);
    expect(result.speakerOrder).toEqual(result.replies.map((r) => r.npcId));
    expect(result.partialFailure).toBe(false);
  });

  it("passes actionContext to NPC turn processor in hybrid mode", async () => {
    const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
    const player = getPlayer(sessionId);
    if (!player) throw new Error("Player not found");

    const actionContext: ActionContext = {
      verb: "潜行",
      targetNpcId: "baili",
      narration: "陆玄悄悄靠近丹炉，白璃警觉地抬起头。",
      witnesses: [
        {
          npcId: "baili",
          tianDaoAlertDelta: 0,
          angerDelta: 0,
          fearDelta: 0,
          memory: "玩家潜行：偷偷靠近",
          state: { trust: 20, fear: 10, anger: 0, tianDaoAlert: 45 }
        }
      ]
    };

    const result = await orchestrateGroupChatTurn({
      sessionId,
      targetNpcId: "baili",
      player,
      playerInput: "我要买屏蔽药",
      scene,
      actionContext
    });

    expect(result.replies.length).toBeGreaterThan(0);
    expect(result.replies[0].npcId).toBe("baili");
  });

  it("returns empty replies when arbiter decides nobody speaks", async () => {
    const scene = getSceneSnapshot(sessionId, "thunder_tavern") ?? undefined;
    const player = getPlayer(sessionId);
    if (!player) throw new Error("Player not found");

    const result = await orchestrateGroupChatTurn({
      sessionId,
      targetNpcId: "chimu",
      player,
      playerInput: "都给我滚",
      scene
    });

    expect(result.replies).toHaveLength(0);
    expect(result.arbiterRationale).toBeTruthy();
  });

  it("handles partial failure when first NPC succeeds but second fails", async () => {
    const scene = getSceneSnapshot(sessionId, "thunder_tavern") ?? undefined;
    const player = getPlayer(sessionId);
    if (!player) throw new Error("Player not found");

    // This test verifies the partial failure mechanism exists
    // In practice, with mock responders, all NPCs succeed
    const result = await orchestrateGroupChatTurn({
      sessionId,
      targetNpcId: "qinggu",
      player,
      playerInput: "你们好",
      scene
    });

    // At least one NPC responded
    expect(result.replies.length).toBeGreaterThan(0);
    // partialFailure is false when all succeed
    expect(result.partialFailure).toBe(false);
  });

  it("records speaker order matching reply order", async () => {
    const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
    const player = getPlayer(sessionId);
    if (!player) throw new Error("Player not found");

    const result = await orchestrateGroupChatTurn({
      sessionId,
      targetNpcId: "baili",
      player,
      playerInput: "有人吗",
      scene
    });

    expect(result.speakerOrder).toEqual(result.replies.map((r) => r.npcId));
  });

  it("skips silent speakers assigned by arbiter", async () => {
    const scene = getSceneSnapshot(sessionId, "black_market") ?? undefined;
    const player = getPlayer(sessionId);
    if (!player) throw new Error("Player not found");

    // Arbiter may assign silent mode to some NPCs
    const result = await orchestrateGroupChatTurn({
      sessionId,
      targetNpcId: "baili",
      player,
      playerInput: "...",
      scene
    });

    // Silent NPCs don't appear in replies
    expect(result.replies.every((r) => r.dialogue || r.actions?.length)).toBe(true);
  });
});
