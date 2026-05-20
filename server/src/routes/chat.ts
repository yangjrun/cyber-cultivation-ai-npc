import { Router, type Response } from "express";
import { applyStateDelta, executeIntent, getNpcProfile, getNpcState, resetNpcState } from "../services/gameState.js";
import { generateNpcResponse } from "../services/llmClient.js";
import { addMemory, clearMemories, getRecentMemories } from "../services/memoryStore.js";
import { getPlayer, sessionExists } from "../services/playerStore.js";
import { buildSystemPrompt, buildUserTurn } from "../services/promptBuilder.js";
import { evaluateIntent as evaluateQuestIntent, getRelevantQuests } from "../services/questEngine.js";
import { validateLlmResponse } from "../services/responseValidator.js";
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
    const scopedNpcId = makeScopedNpcId(sessionId, npcId);
    const memories = getRecentMemories(scopedNpcId, 5);
    const activeSceneId = getActiveSceneId(sessionId);
    const sceneSnapshot = getSceneSnapshot(sessionId, activeSceneId) ?? undefined;
    const activeQuests = getRelevantQuests(sessionId, npcId);

    const systemPrompt = buildSystemPrompt({ npcId });
    const userTurn = buildUserTurn({
      scopedNpcId,
      npcId,
      playerInput,
      memories,
      player,
      scene: sceneSnapshot,
      activeQuests
    });
    const prompt = `${systemPrompt}\n\n${userTurn}`;

    const rawResponse = await generateNpcResponse(prompt, playerInput, npcId);
    const npcResponse = validateLlmResponse(rawResponse);

    applyStateDelta(scopedNpcId, npcResponse.state_delta);
    const baseActionResult = executeIntent(scopedNpcId, npcResponse.intent);
    const questResult = evaluateQuestIntent(sessionId, scopedNpcId, npcResponse.intent);

    const actionResult = [baseActionResult, ...questResult.actionResults].filter(Boolean).join(" / ");

    if (npcResponse.memory) {
      await addMemory(scopedNpcId, npcResponse.memory);
    }

    const responseBody: ChatResponseBody = {
      dialogue: npcResponse.dialogue,
      tone: npcResponse.tone,
      intent: npcResponse.intent,
      state: getNpcState(scopedNpcId),
      memoryAdded: npcResponse.memory,
      actionResult,
      player: resolvePlayer(sessionId)
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
