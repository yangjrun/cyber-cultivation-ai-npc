import { getQuestDefinition } from "../data/quests.js";
import { techniques } from "../data/techniques.js";
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
  memory: "",
  actions: []
};

const allowedIntentSet = new Set<string>(allowedIntents);

export function validateLlmResponse(raw: string | object): ValidatedNpcResponse {
  const parsed = typeof raw === "string" ? parseModelOutput(raw) : raw;

  if (!isRecord(parsed)) {
    return createFallback();
  }

  return {
    dialogue: normalizeDialogue(parsed.dialogue),
    tone: typeof parsed.tone === "string" && parsed.tone.trim() ? parsed.tone.trim() : "",
    intent: normalizeIntent(parsed.intent),
    state_delta: normalizeStateDelta(parsed.state_delta),
    memory: normalizeMemory(parsed.memory),
    actions: normalizeActions(parsed.actions)
  };
}

function createFallback(): ValidatedNpcResponse {
  return {
    ...fallbackResponse,
    intent: { ...fallbackResponse.intent, params: { ...fallbackResponse.intent.params } },
    state_delta: { ...fallbackResponse.state_delta },
    actions: []
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

export function extractFirstJsonObject(rawText: string): string | null {
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

  const cleaned = value.replace(/[\r\n"“”'‘’]/g, "").replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return "";
  }

  const sentences = cleaned.split(/(?<=[。！？!?])/).filter((segment) => segment.trim()).slice(0, 3);
  const finalSentences = sentences.length > 0 ? sentences : [cleaned];

  return finalSentences
    .map((sentence) => {
      const chars = Array.from(sentence);
      return chars.length <= 30 ? sentence : `${chars.slice(0, 30).join("")}…`;
    })
    .join("");
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

function normalizeIntent(value: unknown): NpcIntent {
  if (!isRecord(value) || typeof value.type !== "string" || !allowedIntentSet.has(value.type)) {
    return { type: "none", params: {} };
  }

  const type = value.type as IntentType;

  if (type === "give_quest") {
    const params = isRecord(value.params) ? value.params : {};
    const questId = typeof params.quest_id === "string" ? params.quest_id : null;

    if (questId && getQuestDefinition(questId)) {
      return { type, params: { quest_id: questId } };
    }

    return { type: "none", params: {} };
  }

  if (type === "teach_technique") {
    const params = isRecord(value.params) ? value.params : {};
    const techniqueId = typeof params.technique_id === "string" ? params.technique_id : null;

    if (techniqueId && techniques[techniqueId]) {
      return { type, params: { technique_id: techniqueId } };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
