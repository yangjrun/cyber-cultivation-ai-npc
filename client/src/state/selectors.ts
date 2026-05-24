import type { NpcState } from "../api/chatApi";
import type { ChatMessage } from "../components/DialoguePanel";
import { initialNpcState } from "./constants";
import type { GameStore } from "./types";

const EMPTY_MESSAGES: ChatMessage[] = [];
const EMPTY_MEMORIES: string[] = [];

export function getActiveMessages(state: GameStore): ChatMessage[] {
  return state.messagesByNpc[state.activeNpcId] ?? EMPTY_MESSAGES;
}

export function getActiveMemories(state: GameStore): string[] {
  return state.memoriesByNpc[state.activeNpcId] ?? EMPTY_MEMORIES;
}

export function getActiveNpcState(state: GameStore): NpcState {
  return state.npcStates[state.activeNpcId] ?? initialNpcState;
}
