import type { NpcIntent, NpcState, NpcStateDelta } from "./npc.js";
import type { PlayerState } from "./player.js";

export type InputMode = "dialogue" | "action" | "monologue";

export type SpeakMode = "speak" | "interrupt" | "action_only" | "silent";

export type ArbiterSpeaker = {
  npcId: string;
  mode: SpeakMode;
};

export type ArbiterDecision = {
  speakers: ReadonlyArray<ArbiterSpeaker>;
  rationale: string;
};

export type ChatRequestBody = {
  playerInput: string;
  npcId: string;
  sessionId: string;
  inputMode?: InputMode;
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
  actions?: string[];
};

export type ChatReply = {
  npcId: string;
  dialogue: string;
  tone: string;
  intent: NpcIntent;
  state: NpcState;
  memoryAdded: string;
  actionResult: string;
  kind: InputMode;
  actions: string[];
  affectedStates?: Record<string, NpcState>;
  speakMode?: SpeakMode;
};

export type ChatResponseBody = {
  dialogue: string;
  tone: string;
  intent: NpcIntent;
  state: NpcState;
  memoryAdded: string;
  actionResult: string;
  player: PlayerState;
  inventory: { itemId: string; quantity: number }[];
  replies: ChatReply[];
  mode: InputMode;
  groupChat: {
    sceneId: string;
    speakerOrder: string[];
    partialFailure?: boolean;
    arbiterRationale?: string;
  };
};

export type PromptContext = {
  npcId: string;
  playerInput: string;
  memories: string[];
};
