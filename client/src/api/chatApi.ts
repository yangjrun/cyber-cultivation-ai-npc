import { defaultPlayer, normalizePlayer, type PlayerState } from "./sessionApi";

export type NpcState = {
  trust: number;
  fear: number;
  anger: number;
  tianDaoAlert: number;
};

export type NpcIntent = {
  type: string;
  params: Record<string, unknown>;
};

export type ChatResponse = {
  dialogue: string;
  tone: string;
  intent: NpcIntent;
  state: NpcState | null;
  memoryAdded: string;
  actionResult: string;
  player: PlayerState;
};

const DEFAULT_DIALOGUE = "……丹炉的蓝火沉默了一瞬。";
const CHAT_TIMEOUT_MS = 15000;

export async function sendChat(playerInput: string, npcId = "baili", sessionId?: string): Promise<ChatResponse> {
  const raw = await fetchJsonWithRetry("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      playerInput,
      npcId,
      ...(sessionId ? { sessionId } : {})
    })
  });

  return normalizeChatResponse(raw);
}

export async function resetChat(npcId = "baili", sessionId?: string): Promise<void> {
  await fetchJsonWithRetry("/api/chat/reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      npcId,
      ...(sessionId ? { sessionId } : {})
    })
  });
}

export function normalizeChatResponse(raw: unknown): ChatResponse {
  const record = isRecord(raw) ? raw : {};

  return {
    dialogue: normalizeString(record.dialogue) || DEFAULT_DIALOGUE,
    tone: normalizeString(record.tone),
    intent: normalizeIntent(record.intent),
    state: normalizeState(record.state),
    memoryAdded: normalizeString(record.memoryAdded),
    actionResult: normalizeString(record.actionResult),
    player: normalizePlayer(record.player, defaultPlayer.sessionId, defaultPlayer.id)
  };
}

async function fetchJsonWithRetry(url: string, init: RequestInit): Promise<unknown> {
  const maxAttempts = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchJsonWithTimeout(url, init);
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error) || attempt === maxAttempts) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("request failed");
}

async function fetchJsonWithTimeout(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal
    });

    if (!res.ok) {
      throw new HttpError(res.status);
    }

    if (res.status === 204) {
      return {};
    }

    return await res.json() as unknown;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof HttpError) {
    return [502, 503, 504].includes(error.status);
  }

  return true;
}

class HttpError extends Error {
  constructor(public readonly status: number) {
    super(`request failed with status ${status}`);
  }
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeIntent(value: unknown): NpcIntent {
  if (!isRecord(value)) {
    return { type: "none", params: {} };
  }

  const type = typeof value.type === "string" && value.type ? value.type : "none";
  const params = isRecord(value.params) ? value.params : {};

  return { type, params };
}

function normalizeState(value: unknown): NpcState | null {
  if (!isRecord(value)) {
    return null;
  }

  const fields: Array<keyof NpcState> = ["trust", "fear", "anger", "tianDaoAlert"];

  if (!fields.every((field) => typeof value[field] === "number" && Number.isFinite(value[field]))) {
    return null;
  }

  return {
    trust: value.trust as number,
    fear: value.fear as number,
    anger: value.anger as number,
    tianDaoAlert: value.tianDaoAlert as number
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
