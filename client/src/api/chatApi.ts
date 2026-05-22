import { fetchJsonWithRetry } from "./apiClient";
import { defaultPlayer, normalizePlayer, type PlayerState } from "./sessionApi";

export type InputMode = "dialogue" | "action" | "monologue";

export type SpeakMode = "speak" | "interrupt" | "action_only" | "silent";

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

export type ChatReply = {
  npcId: string;
  dialogue: string;
  tone: string;
  intent: NpcIntent;
  state: NpcState | null;
  memoryAdded: string;
  actionResult: string;
  kind: InputMode;
  actions?: string[];
  speakMode?: SpeakMode;
  affectedStates?: Record<string, NpcState>;
};

export type ChatResponse = {
  dialogue: string;
  tone: string;
  intent: NpcIntent;
  state: NpcState | null;
  memoryAdded: string;
  actionResult: string;
  player: PlayerState;
  replies: ChatReply[];
  mode: InputMode;
};

const DEFAULT_DIALOGUE = "……丹炉的蓝火沉默了一瞬。";
const VALID_MODES: InputMode[] = ["dialogue", "action", "monologue"];

export async function sendChat(
  playerInput: string,
  npcId: string,
  sessionId?: string,
  inputMode?: InputMode
): Promise<ChatResponse> {
  const raw = await fetchJsonWithRetry("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      playerInput,
      npcId,
      ...(sessionId ? { sessionId } : {}),
      ...(inputMode ? { inputMode } : {})
    })
  });

  return normalizeChatResponse(raw, npcId);
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

export function normalizeChatResponse(raw: unknown, fallbackNpcId = "baili"): ChatResponse {
  const record = isRecord(raw) ? raw : {};
  const mode = normalizeMode(record.mode);
  const fallbackReply = normalizeReply(record, fallbackNpcId, mode);
  const replies = Array.isArray(record.replies)
    ? record.replies
        .map((reply) => normalizeReply(reply, fallbackNpcId, mode))
        .filter((reply) => reply.dialogue || (reply.actions && reply.actions.length > 0))
    : [];
  const normalizedReplies = replies.length > 0 ? replies : [normalizeFallbackReply(fallbackReply)];
  const [firstReply] = normalizedReplies;

  return {
    dialogue: firstReply.dialogue,
    tone: firstReply.tone,
    intent: firstReply.intent,
    state: firstReply.state,
    memoryAdded: firstReply.memoryAdded,
    actionResult: firstReply.actionResult,
    player: normalizePlayer(record.player, defaultPlayer.sessionId, defaultPlayer.id),
    replies: normalizedReplies,
    mode
  };
}

function normalizeFallbackReply(reply: ChatReply): ChatReply {
  if (reply.dialogue || (reply.actions && reply.actions.length > 0)) {
    return reply;
  }

  return { ...reply, dialogue: DEFAULT_DIALOGUE };
}

function normalizeReply(raw: unknown, fallbackNpcId: string, fallbackKind: InputMode): ChatReply {
  const record = isRecord(raw) ? raw : {};
  const npcId = normalizeString(record.npcId) || fallbackNpcId;
  const kind = normalizeMode(record.kind, fallbackKind);
  const affectedStates = normalizeAffectedStates(record.affectedStates);
  const actions = normalizeActions(record.actions);
  const speakMode = normalizeSpeakMode(record.speakMode);

  return {
    npcId,
    dialogue: normalizeString(record.dialogue),
    tone: normalizeString(record.tone),
    intent: normalizeIntent(record.intent),
    state: normalizeState(record.state),
    memoryAdded: normalizeString(record.memoryAdded),
    actionResult: normalizeString(record.actionResult),
    kind,
    ...(actions.length > 0 ? { actions } : {}),
    ...(speakMode ? { speakMode } : {}),
    ...(affectedStates ? { affectedStates } : {})
  };
}

const VALID_SPEAK_MODES: SpeakMode[] = ["speak", "interrupt", "action_only", "silent"];

function normalizeSpeakMode(value: unknown): SpeakMode | undefined {
  return typeof value === "string" && VALID_SPEAK_MODES.includes(value as SpeakMode)
    ? (value as SpeakMode)
    : undefined;
}

function normalizeActions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeAffectedStates(value: unknown): Record<string, NpcState> | null {
  if (!isRecord(value)) {
    return null;
  }

  const result: Record<string, NpcState> = {};

  for (const [key, raw] of Object.entries(value)) {
    const state = normalizeState(raw);
    if (state) {
      result[key] = state;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function normalizeMode(value: unknown, fallback: InputMode = "dialogue"): InputMode {
  return typeof value === "string" && VALID_MODES.includes(value as InputMode)
    ? (value as InputMode)
    : fallback;
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
