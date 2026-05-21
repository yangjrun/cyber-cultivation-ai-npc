import { processNpcTurn } from "./npcTurnProcessor.js";
import type { ChatReply } from "../types/chat.js";
import type { PlayerState } from "../types/player.js";
import type { SceneSnapshot } from "../types/scene.js";

const DEFAULT_MAX_REPLIES = 2;

export type GroupChatResult = {
  replies: ChatReply[];
  speakerOrder: string[];
  partialFailure: boolean;
};

export type OrchestrateGroupChatInput = {
  sessionId: string;
  targetNpcId: string;
  player: PlayerState;
  playerInput: string;
  scene?: SceneSnapshot;
  maxReplies?: number;
};

export async function orchestrateGroupChatTurn({
  sessionId,
  targetNpcId,
  player,
  playerInput,
  scene,
  maxReplies = DEFAULT_MAX_REPLIES
}: OrchestrateGroupChatInput): Promise<GroupChatResult> {
  const speakers = selectSpeakers(scene, targetNpcId, maxReplies);
  const replies: ChatReply[] = [];
  let partialFailure = false;

  for (const speaker of speakers) {
    try {
      const reply = await processNpcTurn({
        sessionId,
        npcId: speaker,
        player,
        playerInput,
        scene,
        priorReplies: replies.map(({ npcId, dialogue }) => ({ npcId, dialogue })),
        applyActions: replies.length === 0
      });
      replies.push(reply);
    } catch (error) {
      if (replies.length === 0) {
        throw error;
      }

      partialFailure = true;
    }
  }

  return {
    replies,
    speakerOrder: replies.map((reply) => reply.npcId),
    partialFailure
  };
}

function selectSpeakers(scene: SceneSnapshot | undefined, targetNpcId: string, maxReplies: number): string[] {
  const limit = Math.max(1, Math.trunc(maxReplies));
  const sceneNpcIds = scene?.scene.npcIds ?? [];

  if (!sceneNpcIds.includes(targetNpcId)) {
    return [targetNpcId];
  }

  return [targetNpcId, ...sceneNpcIds.filter((npcId) => npcId !== targetNpcId)].slice(0, limit);
}
