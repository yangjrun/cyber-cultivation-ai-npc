import { Router, type Response } from "express";
import { applyStateDelta, executeIntent, getNpcProfile, getNpcState, resetNpcState } from "../services/gameState.js";
import { generateNpcResponse } from "../services/llmClient.js";
import { addMemory, clearMemories, getRecentMemories } from "../services/memoryStore.js";
import { getPlayer, sessionExists } from "../services/playerStore.js";
import { buildPrompt } from "../services/promptBuilder.js";
import { validateLlmResponse } from "../services/responseValidator.js";
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

    const scopedNpcId = createScopedNpcId(npcId, sessionId);
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
    const scopedNpcId = createScopedNpcId(npcId, sessionId);
    const memories = getRecentMemories(scopedNpcId, 5);
    const prompt = buildPrompt({ npcId, scopedNpcId, playerInput, memories, player });
    const rawResponse = await generateNpcResponse(prompt, playerInput);
    const npcResponse = validateLlmResponse(rawResponse);

    applyStateDelta(scopedNpcId, npcResponse.state_delta);
    const actionResult = executeIntent(scopedNpcId, npcResponse.intent);
    addMemory(scopedNpcId, npcResponse.memory);

    const responseBody: ChatResponseBody = {
      dialogue: npcResponse.dialogue,
      tone: npcResponse.tone,
      intent: npcResponse.intent,
      state: getNpcState(scopedNpcId),
      memoryAdded: npcResponse.memory,
      actionResult,
      player
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

function createScopedNpcId(npcId: string, sessionId: string): string {
  return `${sessionId}::${npcId}`;
}
