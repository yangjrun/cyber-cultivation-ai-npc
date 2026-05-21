import { Router, type Response } from "express";
import { getNpcProfile, resetNpcState } from "../services/gameState.js";
import { orchestrateGroupChatTurn } from "../services/groupChatOrchestrator.js";
import { clearMemories } from "../services/memoryStore.js";
import { getPlayer, sessionExists } from "../services/playerStore.js";
import { resetPersonality } from "../services/personalityEvolution.js";
import { getActiveSceneId, getSceneSnapshot } from "../services/sceneStore.js";
import { scopedNpcId as makeScopedNpcId } from "../services/scopedNpcId.js";
import { validateChatRequest, validateResetRequest } from "../schemas/chat.js";
import type { ChatResponseBody } from "../types/chat.js";
import type { PlayerState } from "../types/player.js";

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

    const { playerInput, npcId, sessionId } = validation.body;

    if (!isKnownNpc(npcId, res) || !isKnownSession(sessionId, res)) {
      return;
    }

    const player = resolvePlayer(sessionId);
    const activeSceneId = getActiveSceneId(sessionId);
    const scene = getSceneSnapshot(sessionId, activeSceneId) ?? undefined;
    const groupChat = await orchestrateGroupChatTurn({
      sessionId,
      targetNpcId: npcId,
      player,
      playerInput,
      scene
    });
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
      groupChat: {
        sceneId: activeSceneId,
        speakerOrder: groupChat.speakerOrder,
        ...(groupChat.partialFailure ? { partialFailure: true } : {})
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
