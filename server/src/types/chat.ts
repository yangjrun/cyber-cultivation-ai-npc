import type { NpcIntent, NpcState, NpcStateDelta } from "./npc.js";
import type { PlayerState } from "./player.js";

export type ChatRequestBody = {
  playerInput: string;
  npcId: string;
  sessionId: string;
};

export type ResetRequestBody = {
  npcId: string;
  sessionId: string;
};

export type ValidatedNpcResponse = {
  dialogue: string;
  tone: string;
  intent: NpcIntent;
  state_delta: NpcStateDelta;
  memory: string;
};

export type ChatResponseBody = {
  dialogue: string;
  tone: string;
  intent: NpcIntent;
  state: NpcState;
  memoryAdded: string;
  actionResult: string;
  player: PlayerState;
};

export type PromptContext = {
  npcId: string;
  playerInput: string;
  memories: string[];
};
