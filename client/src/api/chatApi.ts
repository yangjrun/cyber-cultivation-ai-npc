import { fetchJsonWithRetry } from "./apiClient";
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

export async function sendChat(playerInput: string, npcId: string, sessionId?: string): Promise<ChatResponse> {
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

export async function resetChat(npcId: string, sessionId?: string): Promise<void> {
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
