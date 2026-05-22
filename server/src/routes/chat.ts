import { Router, type Response } from "express";
import { resolveAction } from "../services/actionResolver.js";
import { getNpcProfile, getNpcState, resetNpcState } from "../services/gameState.js";
import { orchestrateGroupChatTurn } from "../services/groupChatOrchestrator.js";
import { clearMemories } from "../services/memoryStore.js";
import { echoMonologue } from "../services/narratorEcho.js";
import { getPlayer, sessionExists } from "../services/playerStore.js";
import { resetPersonality } from "../services/personalityEvolution.js";
import { getActiveSceneId, getSceneSnapshot } from "../services/sceneStore.js";
import { scopedNpcId as makeScopedNpcId } from "../services/scopedNpcId.js";
import { validateChatRequest, validateResetRequest } from "../schemas/chat.js";
import type { ChatReply, ChatResponseBody, InputMode } from "../types/chat.js";
import type { NpcState } from "../types/npc.js";
import type { PlayerState } from "../types/player.js";

const NARRATOR_NPC_ID = "narrator";
const EMPTY_NPC_STATE = { trust: 0, fear: 0, anger: 0, tianDaoAlert: 0 } as const;

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

    const player = resolvePlayer(sessionId);
    const activeSceneId = getActiveSceneId(sessionId);
    const scene = getSceneSnapshot(sessionId, activeSceneId) ?? undefined;

    if (mode === "dialogue") {
      const groupChat = await orchestrateGroupChatTurn({
        sessionId,
        targetNpcId: npcId,
        player,
        playerInput,
        scene
      });

      if (groupChat.replies.length === 0) {
        const silenceReply: ChatReply = {
          npcId: NARRATOR_NPC_ID,
          dialogue: "场内一片安静，只有义体风铃在响。",
          tone: "环境",
          intent: { type: "none", params: {} },
          state: { ...EMPTY_NPC_STATE },
          memoryAdded: "",
          actionResult: "",
          kind: "dialogue"
        };

        const silenceBody: ChatResponseBody = {
          dialogue: silenceReply.dialogue,
          tone: silenceReply.tone,
          intent: silenceReply.intent,
          state: silenceReply.state,
          memoryAdded: silenceReply.memoryAdded,
          actionResult: silenceReply.actionResult,
          player,
          replies: [silenceReply],
          mode,
          groupChat: {
            sceneId: activeSceneId,
            speakerOrder: [NARRATOR_NPC_ID],
            ...(groupChat.arbiterRationale ? { arbiterRationale: groupChat.arbiterRationale } : {})
          }
        };

        res.json(silenceBody);
        return;
      }

      const [firstReply] = groupChat.replies;

      if (!firstReply) {
        throw new Error("NPC response missing");
      }

      const responseBody: ChatResponseBody = {
        dialogue: firstReply.dialogue,
        tone: firstReply.tone,
        intent: firstReply.intent,
        state: firstReply.state,
        memoryAdded: firstReply.memoryAdded,
        actionResult: firstReply.actionResult,
        player: resolvePlayer(sessionId),
        replies: groupChat.replies,
        mode,
        groupChat: {
          sceneId: activeSceneId,
          speakerOrder: groupChat.speakerOrder,
          ...(groupChat.partialFailure ? { partialFailure: true } : {}),
          ...(groupChat.arbiterRationale ? { arbiterRationale: groupChat.arbiterRationale } : {})
        }
      };

      res.json(responseBody);
      return;
    }

    const scopedNpcId = makeScopedNpcId(sessionId, npcId);
    let narrationText = playerInput;
    let affectedStates: Record<string, NpcState> | undefined;

    if (mode === "monologue") {
      const echoResult = await echoMonologue({ sessionId, playerInput, scene });
      narrationText = echoResult.narration;
      if (Object.keys(echoResult.affectedStates).length > 0) {
        affectedStates = echoResult.affectedStates;
      }
    } else if (mode === "action") {
      const actionResult = await resolveAction({ sessionId, playerInput, scene });
      narrationText = actionResult.narration;
      if (Object.keys(actionResult.affectedStates).length > 0) {
        affectedStates = actionResult.affectedStates;
      }
    }

    const narratorReply: ChatReply = {
      npcId: NARRATOR_NPC_ID,
      dialogue: narrationText,
      tone: mode === "action" ? "旁白" : "心声",
      intent: { type: "none", params: {} },
      state: getNpcState(scopedNpcId) ?? { ...EMPTY_NPC_STATE },
      memoryAdded: "",
      actionResult: "",
      kind: mode,
      ...(affectedStates ? { affectedStates } : {})
    };

    const responseBody: ChatResponseBody = {
      dialogue: narratorReply.dialogue,
      tone: narratorReply.tone,
      intent: narratorReply.intent,
      state: narratorReply.state,
      memoryAdded: narratorReply.memoryAdded,
      actionResult: narratorReply.actionResult,
      player,
      replies: [narratorReply],
      mode,
      groupChat: {
        sceneId: activeSceneId,
        speakerOrder: [NARRATOR_NPC_ID]
      }
    };

    res.json(responseBody);
  } catch (error) {
    next(error);
  }
});

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
