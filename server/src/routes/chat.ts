import { Router } from "express";
import { applyStateDelta, executeIntent, getNpcProfile, getNpcState, resetNpcState } from "../services/gameState.js";
import { generateNpcResponse } from "../services/llmClient.js";
import { addMemory, clearMemories, getRecentMemories } from "../services/memoryStore.js";
import { buildPrompt } from "../services/promptBuilder.js";
import { validateLlmResponse } from "../services/responseValidator.js";
import type { ChatRequestBody, ChatResponseBody, ResetRequestBody } from "../types/chat.js";

export const chatRouter = Router();

chatRouter.post("/reset", (req, res) => {
  const validation = validateResetRequest(req.body);

  if (!validation.ok) {
    res.status(validation.status).json({ error: validation.message });
    return;
  }

  const { npcId, sessionId } = validation.body;
  const scopedNpcId = createScopedNpcId(npcId, sessionId);
  const state = resetNpcState(scopedNpcId);
  clearMemories(scopedNpcId);

  res.json({ state, memories: [], actionResult: "" });
});

chatRouter.post("/", async (req, res, next) => {
  try {
    const validation = validateChatRequest(req.body);

    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.message });
      return;
    }

    const { playerInput, npcId, sessionId } = validation.body;
    const scopedNpcId = createScopedNpcId(npcId, sessionId);
    const memories = getRecentMemories(scopedNpcId, 5);
    const prompt = buildPrompt(npcId, playerInput, memories);
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
      actionResult
    };

    res.json(responseBody);
  } catch (error) {
    next(error);
  }
});

type RequestValidation =
  | { ok: true; body: ChatRequestBody }
  | { ok: false; status: number; message: string };

function validateChatRequest(body: unknown): RequestValidation {
  if (!isRecord(body)) {
    return { ok: false, status: 400, message: "请求体必须是 JSON 对象。" };
  }

  if (typeof body.playerInput !== "string") {
    return { ok: false, status: 400, message: "playerInput 必须是字符串。" };
  }

  const playerInput = body.playerInput.trim();

  if (playerInput.length === 0 || Array.from(playerInput).length > 80) {
    return { ok: false, status: 400, message: "playerInput 必须是 1 到 80 个字符。" };
  }

  if (typeof body.npcId !== "string" || body.npcId.trim().length === 0) {
    return { ok: false, status: 400, message: "npcId 必须是字符串。" };
  }

  const npcId = body.npcId.trim();

  try {
    getNpcProfile(npcId);
  } catch {
    return { ok: false, status: 404, message: "NPC 不存在。" };
  }

  const sessionId = normalizeSessionId(body.sessionId);

  if (sessionId === null) {
    return { ok: false, status: 400, message: "sessionId 必须是 1 到 80 个字符。" };
  }

  return {
    ok: true,
    body: {
      playerInput,
      npcId,
      ...(sessionId ? { sessionId } : {})
    }
  };
}

type ResetValidation =
  | { ok: true; body: ResetRequestBody }
  | { ok: false; status: number; message: string };

function validateResetRequest(body: unknown): ResetValidation {
  if (!isRecord(body)) {
    return { ok: false, status: 400, message: "请求体必须是 JSON 对象。" };
  }

  if (typeof body.npcId !== "string" || body.npcId.trim().length === 0) {
    return { ok: false, status: 400, message: "npcId 必须是字符串。" };
  }

  const npcId = body.npcId.trim();
  const sessionId = normalizeSessionId(body.sessionId);

  if (sessionId === null) {
    return { ok: false, status: 400, message: "sessionId 必须是 1 到 80 个字符。" };
  }

  try {
    getNpcProfile(npcId);
  } catch {
    return { ok: false, status: 404, message: "NPC 不存在。" };
  }

  return {
    ok: true,
    body: {
      npcId,
      ...(sessionId ? { sessionId } : {})
    }
  };
}

function normalizeSessionId(value: unknown): string | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return null;
  }

  const sessionId = value.trim();

  if (sessionId.length === 0 || Array.from(sessionId).length > 80) {
    return null;
  }

  return sessionId;
}

function createScopedNpcId(npcId: string, sessionId?: string): string {
  return sessionId ? `${sessionId}::${npcId}` : npcId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
