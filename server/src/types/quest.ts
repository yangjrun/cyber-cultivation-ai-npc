import type { IntentType, NpcState, NpcStateDelta } from "./npc.js";

export type QuestStatus = "available" | "accepted" | "in_progress" | "completed" | "failed";

export type QuestTrigger =
  | { kind: "intent"; intentType: IntentType; npcId: string }
  | { kind: "flag"; key: string; expectedValue: unknown }
  | { kind: "npc_state_threshold"; npcId: string; field: keyof NpcState; op: ">=" | "<="; value: number };

export type QuestEffect =
  | { kind: "npc_state_delta"; npcId: string; delta: Partial<NpcStateDelta> }
  | { kind: "relation_delta"; from: string; to: string; trust?: number; hostility?: number }
  | { kind: "give_item"; itemId: string; quantity: number }
  | { kind: "give_stones"; amount: number }
  | { kind: "set_flag"; key: string; value: unknown };

export type QuestDefinition = {
  questId: string;
  title: string;
  description: string;
  giverNpcId: string;
  involvedNpcIds: string[];
  acceptableViaIntent: IntentType;
  completionTriggers: QuestTrigger[];
  failureTriggers: QuestTrigger[];
  effectsOnAccept: QuestEffect[];
  effectsOnComplete: QuestEffect[];
  effectsOnFail: QuestEffect[];
};

export type QuestProgress = {
  sessionId: string;
  questId: string;
  status: QuestStatus;
  progress: Record<string, unknown>;
  acceptedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
};
