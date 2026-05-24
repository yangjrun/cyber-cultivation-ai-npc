import { createSession, getSession } from "../api/sessionApi";
import type { ChatMessage } from "../components/DialoguePanel";
import { MAX_INPUT, MAX_MEMORIES, NPC_NAMES, STORAGE_KEY } from "./constants";
import type { GameStore } from "./types";
import type { InputMode } from "../api/chatApi";

export function getNpcName(npcId: string): string {
  return NPC_NAMES[npcId] ?? npcId;
}

export function nowTime(): string {
  const date = new Date();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function uid(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function clampInput(value: string): string {
  return Array.from(value).slice(0, MAX_INPUT).join("");
}

export function appendMessages(
  map: Record<string, ChatMessage[]>,
  npcId: string,
  messages: ChatMessage[]
): Record<string, ChatMessage[]> {
  const current = map[npcId] ?? [];
  return { ...map, [npcId]: [...current, ...messages] };
}

export function appendMessage(
  map: Record<string, ChatMessage[]>,
  npcId: string,
  message: ChatMessage
): Record<string, ChatMessage[]> {
  return appendMessages(map, npcId, [message]);
}

export function appendMemory(
  map: Record<string, string[]>,
  npcId: string,
  memory: string
): Record<string, string[]> {
  const current = map[npcId] ?? [];
  return { ...map, [npcId]: [...current, memory].slice(-MAX_MEMORIES) };
}

export function buildSendLog(mode: InputMode): string {
  if (mode === "action") return "玩家执行动作。";
  if (mode === "monologue") return "玩家心声闪过。";
  return "玩家发送灵识讯息。";
}

export function buildNarratorLabel(mode: InputMode): string {
  if (mode === "monologue") return "心声";
  return "旁白";
}

export function readStoredSessionId(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeStoredSessionId(sessionId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, sessionId);
  } catch {
    // localStorage can be unavailable in hardened browser contexts.
  }
}

export async function restoreOrCreateSession(sessionId: string) {
  try {
    return await getSession(sessionId);
  } catch {
    return await createSession();
  }
}

export async function ensureSession(get: () => GameStore): Promise<string> {
  if (!get().sessionId) {
    await get().initializeSession();
  }
  return get().sessionId;
}
