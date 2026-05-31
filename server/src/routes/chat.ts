import { Router, type Response } from "express";
import { resolveAction, type ActionVerb, type ActionWitness } from "../services/actionResolver.js";
import { generateActionNarration } from "../services/actionNarrator.js";
import { getNpcProfile, getNpcState, resetNpcState } from "../services/gameState.js";
import { orchestrateGroupChatTurn } from "../services/groupChatOrchestrator.js";
import { clearMemories } from "../services/memoryStore.js";
import { echoMonologue } from "../services/narratorEcho.js";
import { getInventory } from "../services/inventoryStore.js";
import { getPlayer, sessionExists } from "../services/playerStore.js";
import { resetPersonality } from "../services/personalityEvolution.js";
import { getActiveSceneId, getSceneSnapshot } from "../services/sceneStore.js";
import { scopedNpcId as makeScopedNpcId } from "../services/scopedNpcId.js";
import { validateChatRequest, validateResetRequest } from "../schemas/chat.js";
import type { ChatReply, ChatResponseBody, InputMode } from "../types/chat.js";
import type { NpcState } from "../types/npc.js";
import type { PlayerState } from "../types/player.js";
import type { SceneSnapshot } from "../types/scene.js";

export type ActionContext = {
  verb: ActionVerb;
  targetNpcId: string | null;
  narration: string;
  witnesses: ActionWitness[];
};

const NARRATOR_NPC_ID = "narrator";
const EMPTY_NPC_STATE: NpcState = { trust: 0, fear: 0, anger: 0, tianDaoAlert: 0 };

type TurnContext = {
  sessionId: string;
  npcId: string;
  playerInput: string;
  player: PlayerState;
  activeSceneId: string;
  scene: SceneSnapshot | undefined;
};

export const chatRouter = Router();

chatRouter.post("/reset", (req, res, next) => {
  try {
    const validation = validateResetRequest(req.body);

    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.message });
      return;
    }

    const { npcId, sessionId } = validation.body;

    if (!isKnownNpc(npcId, res) || !isKnownSession(sessionId, res)) {
      return;
    }

    const scopedNpcId = makeScopedNpcId(sessionId, npcId);
    const state = resetNpcState(scopedNpcId);
    clearMemories(scopedNpcId);
    resetPersonality(sessionId, npcId);

    res.json({ state, memories: [], actionResult: "" });
  } catch (error) {
    next(error);
  }
});

chatRouter.post("/", async (req, res, next) => {
  try {
    const validation = validateChatRequest(req.body);

    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.message });
      return;
    }

    const { playerInput, npcId, sessionId, inputMode } = validation.body;
    const mode: InputMode = inputMode ?? "dialogue";

    if (!isKnownNpc(npcId, res) || !isKnownSession(sessionId, res)) {
      return;
    }

    const activeSceneId = getActiveSceneId(sessionId);
    const ctx: TurnContext = {
      sessionId,
      npcId,
      playerInput,
      player: resolvePlayer(sessionId),
      activeSceneId,
      scene: getSceneSnapshot(sessionId, activeSceneId) ?? undefined
    };

    const body = mode === "dialogue"
      ? await handleDialogueTurn(ctx)
      : mode === "monologue"
        ? await handleMonologueTurn(ctx)
        : mode === "hybrid"
          ? await handleHybridTurn(ctx)
          : await handleActionTurn(ctx);

    res.json(body);
  } catch (error) {
    console.error("[chatRouter] Error processing chat request:", error);
    next(error);
  }
});

async function handleDialogueTurn(ctx: TurnContext): Promise<ChatResponseBody> {
  const groupChat = await orchestrateGroupChatTurn({
    sessionId: ctx.sessionId,
    targetNpcId: ctx.npcId,
    player: ctx.player,
    playerInput: ctx.playerInput,
    scene: ctx.scene
  });

  if (groupChat.replies.length === 0) {
    return buildSilenceBody(ctx, groupChat.arbiterRationale);
  }

  const [firstReply] = groupChat.replies;
  if (!firstReply) {
    throw new Error("NPC response missing");
  }

  return {
    dialogue: firstReply.dialogue,
    tone: firstReply.tone,
    intent: firstReply.intent,
    state: firstReply.state,
    memoryAdded: firstReply.memoryAdded,
    actionResult: firstReply.actionResult,
    player: resolvePlayer(ctx.sessionId),
    inventory: getInventory(ctx.sessionId),
    replies: groupChat.replies,
    mode: "dialogue",
    groupChat: {
      sceneId: ctx.activeSceneId,
      speakerOrder: groupChat.speakerOrder,
      ...(groupChat.partialFailure ? { partialFailure: true } : {}),
      ...(groupChat.arbiterRationale ? { arbiterRationale: groupChat.arbiterRationale } : {})
    }
  };
}

async function handleMonologueTurn(ctx: TurnContext): Promise<ChatResponseBody> {
  const echo = await echoMonologue({
    sessionId: ctx.sessionId,
    playerInput: ctx.playerInput,
    scene: ctx.scene
  });
  const affectedStates = Object.keys(echo.affectedStates).length > 0 ? echo.affectedStates : undefined;
  return buildNarratorBody(ctx, "monologue", echo.narration, "心声", affectedStates);
}

async function handleActionTurn(ctx: TurnContext): Promise<ChatResponseBody> {
  const action = await resolveAction({
    sessionId: ctx.sessionId,
    playerInput: ctx.playerInput,
    scene: ctx.scene
  });

  // Generate vivid narration using LLM
  const narrationResult = await generateActionNarration({
    sessionId: ctx.sessionId,
    playerInput: ctx.playerInput,
    actionVerb: action.verb,
    targetNpcId: action.targetNpcId,
    scene: ctx.scene,
    witnesses: action.witnesses,
    player: ctx.player
  });

  const affectedStates = Object.keys(action.affectedStates).length > 0 ? action.affectedStates : undefined;
  return buildNarratorBody(ctx, "action", narrationResult.narration, "旁白", affectedStates);
}

async function handleHybridTurn(ctx: TurnContext): Promise<ChatResponseBody> {
  // Step 1: Resolve action (updates state, adds memories)
  const action = await resolveAction({
    sessionId: ctx.sessionId,
    playerInput: ctx.playerInput,
    scene: ctx.scene
  });

  // Step 2: Generate action narration
  const narrationResult = await generateActionNarration({
    sessionId: ctx.sessionId,
    playerInput: ctx.playerInput,
    actionVerb: action.verb,
    targetNpcId: action.targetNpcId,
    scene: ctx.scene,
    witnesses: action.witnesses,
    player: ctx.player
  });

  // Step 3: Build action context for NPCs
  const actionContext: ActionContext = {
    verb: action.verb,
    targetNpcId: action.targetNpcId,
    narration: narrationResult.narration,
    witnesses: action.witnesses
  };

  // Step 4: Orchestrate NPC responses with action context
  const groupChat = await orchestrateGroupChatTurn({
    sessionId: ctx.sessionId,
    targetNpcId: ctx.npcId,
    player: ctx.player,
    playerInput: ctx.playerInput,
    scene: ctx.scene,
    actionContext
  });

  // Step 5: Build narrator reply for the action
  const scopedNpcId = makeScopedNpcId(ctx.sessionId, ctx.npcId);
  const affectedStates = Object.keys(action.affectedStates).length > 0 ? action.affectedStates : undefined;
  const narratorReply: ChatReply = {
    npcId: NARRATOR_NPC_ID,
    dialogue: narrationResult.narration,
    tone: "旁白",
    intent: { type: "none", params: {} },
    state: getNpcState(scopedNpcId) ?? { ...EMPTY_NPC_STATE },
    memoryAdded: "",
    actionResult: "",
    kind: "action",
    actions: [],
    ...(affectedStates ? { affectedStates } : {})
  };

  // Step 6: Combine narrator reply with NPC replies
  const allReplies = [narratorReply, ...groupChat.replies];

  // Use first NPC reply for top-level fields (backward compatibility)
  const firstNpcReply = groupChat.replies[0];
  const topLevelReply = firstNpcReply ?? narratorReply;

  return {
    dialogue: topLevelReply.dialogue,
    tone: topLevelReply.tone,
    intent: topLevelReply.intent,
    state: topLevelReply.state,
    memoryAdded: topLevelReply.memoryAdded,
    actionResult: topLevelReply.actionResult,
    player: resolvePlayer(ctx.sessionId),
    inventory: getInventory(ctx.sessionId),
    replies: allReplies,
    mode: "hybrid",
    groupChat: {
      sceneId: ctx.activeSceneId,
      speakerOrder: allReplies.map((r) => r.npcId),
      ...(groupChat.partialFailure ? { partialFailure: true } : {}),
      ...(groupChat.arbiterRationale ? { arbiterRationale: groupChat.arbiterRationale } : {})
    }
  };
}

function buildSilenceBody(ctx: TurnContext, arbiterRationale: string | undefined): ChatResponseBody {
  const silenceReply: ChatReply = {
    npcId: NARRATOR_NPC_ID,
    dialogue: "场内一片安静，只有义体风铃在响。",
    tone: "环境",
    intent: { type: "none", params: {} },
    state: { ...EMPTY_NPC_STATE },
    memoryAdded: "",
    actionResult: "",
    kind: "dialogue",
    actions: []
  };

  return {
    dialogue: silenceReply.dialogue,
    tone: silenceReply.tone,
    intent: silenceReply.intent,
    state: silenceReply.state,
    memoryAdded: silenceReply.memoryAdded,
    actionResult: silenceReply.actionResult,
    player: ctx.player,
    inventory: getInventory(ctx.sessionId),
    replies: [silenceReply],
    mode: "dialogue",
    groupChat: {
      sceneId: ctx.activeSceneId,
      speakerOrder: [NARRATOR_NPC_ID],
      ...(arbiterRationale ? { arbiterRationale } : {})
    }
  };
}

function buildNarratorBody(
  ctx: TurnContext,
  mode: Exclude<InputMode, "dialogue">,
  narration: string,
  tone: string,
  affectedStates: Record<string, NpcState> | undefined
): ChatResponseBody {
  const scopedNpcId = makeScopedNpcId(ctx.sessionId, ctx.npcId);
  const narratorReply: ChatReply = {
    npcId: NARRATOR_NPC_ID,
    dialogue: narration,
    tone,
    intent: { type: "none", params: {} },
    state: getNpcState(scopedNpcId) ?? { ...EMPTY_NPC_STATE },
    memoryAdded: "",
    actionResult: "",
    kind: mode,
    actions: [],
    ...(affectedStates ? { affectedStates } : {})
  };

  return {
    dialogue: narratorReply.dialogue,
    tone: narratorReply.tone,
    intent: narratorReply.intent,
    state: narratorReply.state,
    memoryAdded: narratorReply.memoryAdded,
    actionResult: narratorReply.actionResult,
    player: ctx.player,
    inventory: getInventory(ctx.sessionId),
    replies: [narratorReply],
    mode,
    groupChat: {
      sceneId: ctx.activeSceneId,
      speakerOrder: [NARRATOR_NPC_ID]
    }
  };
}

function resolvePlayer(sessionId: string): PlayerState {
  const player = getPlayer(sessionId);

  if (!player) {
    throw new Error("Player not found");
  }

  return player;
}

function isKnownNpc(npcId: string, res: Response): boolean {
  try {
    getNpcProfile(npcId);
    return true;
  } catch {
    res.status(404).json({ error: "NPC 不存在。" });
    return false;
  }
}

function isKnownSession(sessionId: string, res: Response): boolean {
  if (sessionExists(sessionId)) {
    return true;
  }

  res.status(404).json({ error: "Session 不存在。" });
  return false;
}
