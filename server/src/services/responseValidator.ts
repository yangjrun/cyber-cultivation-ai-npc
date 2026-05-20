import { allowedIntents } from "./gameState.js";
import type { IntentType, NpcIntent, NpcStateDelta } from "../types/npc.js";
import type { ValidatedNpcResponse } from "../types/chat.js";

export const fallbackResponse: ValidatedNpcResponse = {
  dialogue: "少废话。你到底买不买？",
  tone: "不耐烦",
  intent: {
    type: "none",
    params: {}
  },
  state_delta: {
    trust: 0,
    fear: 0,
    anger: 0,
    tianDaoAlert: 0
  },
  memory: ""
};

const allowedIntentSet = new Set<string>(allowedIntents);

export function validateLlmResponse(raw: string | object): ValidatedNpcResponse {
  const parsed = typeof raw === "string" ? parseModelOutput(raw) : raw;

  if (!isRecord(parsed)) {
    return createFallback();
  }

  return {
    dialogue: normalizeDialogue(parsed.dialogue),
    tone: typeof parsed.tone === "string" && parsed.tone.trim() ? parsed.tone.trim() : fallbackResponse.tone,
    intent: normalizeIntent(parsed.intent),
    state_delta: normalizeStateDelta(parsed.state_delta),
    memory: normalizeMemory(parsed.memory)
  };
}

function createFallback(): ValidatedNpcResponse {
  return {
    ...fallbackResponse,
    intent: { ...fallbackResponse.intent, params: { ...fallbackResponse.intent.params } },
    state_delta: { ...fallbackResponse.state_delta }
  };
}

function parseModelOutput(rawText: string): unknown {
  const jsonText = extractFirstJsonObject(rawText);

  if (!jsonText) {
    return null;
  }

  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function extractFirstJsonObject(rawText: string): string | null {
  const start = rawText.indexOf("{");

  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < rawText.length; index += 1) {
    const char = rawText[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return rawText.slice(start, index + 1);
      }
    }
  }

  return null;
}

function normalizeDialogue(value: unknown): string {
  if (typeof value !== "string") {
    return fallbackResponse.dialogue;
  }

  const normalized = value.replace(/[\r\n\"“”'‘’]/g, "").replace(/\s+/g, " ").trim();
  const safeDialogue = toSingleSentence(normalized || fallbackResponse.dialogue);
  const chars = Array.from(safeDialogue);

  if (chars.length <= 40) {
    return safeDialogue;
  }

  return `${chars.slice(0, 40).join("")}…`;
}

function normalizeIntent(value: unknown): NpcIntent {
  if (!isRecord(value) || typeof value.type !== "string" || !allowedIntentSet.has(value.type)) {
    return { type: "none", params: {} };
  }

  const type = value.type as IntentType;

  if (type === "give_quest") {
    const params = isRecord(value.params) ? value.params : {};

    if (params.quest_id === "steal_inspector_key") {
      return { type, params: { quest_id: "steal_inspector_key" } };
    }

    return { type: "none", params: {} };
  }

  if (type === "teach_technique") {
    const params = isRecord(value.params) ? value.params : {};

    if (params.technique_id === "basic_breathing") {
      return { type, params: { technique_id: "basic_breathing" } };
    }

    return { type: "none", params: {} };
  }

  return {
    type,
    params: {}
  };
}

function normalizeStateDelta(value: unknown): NpcStateDelta {
  const record = isRecord(value) ? value : {};

  return {
    trust: normalizeDeltaValue(record.trust),
    fear: normalizeDeltaValue(record.fear),
    anger: normalizeDeltaValue(record.anger),
    tianDaoAlert: normalizeDeltaValue(record.tianDaoAlert)
  };
}

function normalizeDeltaValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(10, Math.max(-10, value));
}

function normalizeMemory(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return Array.from(value.replace(/[\r\n]/g, "").replace(/\s+/g, " ").trim()).slice(0, 60).join("");
}

function toSingleSentence(text: string): string {
  const chars = Array.from(text);
  const endingIndex = chars.findIndex((char) => ["。", "！", "？", "!", "?"].includes(char));

  if (endingIndex === -1) {
    return text;
  }

  return chars.slice(0, endingIndex + 1).join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
