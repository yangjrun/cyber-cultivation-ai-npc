import { processNpcTurn } from "./npcTurnProcessor.js";
import { arbitrateTurn } from "./turnArbiter.js";
import { getLastSpokeTurns, recordSpeakers } from "./speakerLog.js";
import { getAllNpcStatesForSession } from "./gameState.js";
import type { ChatReply } from "../types/chat.js";
import type { PlayerState } from "../types/player.js";
import type { SceneSnapshot } from "../types/scene.js";

export type GroupChatResult = {
  replies: ChatReply[];
  speakerOrder: string[];
  partialFailure: boolean;
  arbiterRationale: string;
};

export type OrchestrateGroupChatInput = {
  sessionId: string;
  targetNpcId: string;
  player: PlayerState;
  playerInput: string;
  scene?: SceneSnapshot;
};

export async function orchestrateGroupChatTurn({
  sessionId,
  targetNpcId,
  player,
  playerInput,
  scene
}: OrchestrateGroupChatInput): Promise<GroupChatResult> {
  const npcStates = getAllNpcStatesForSession(sessionId);
  const lastSpokeTurns = getLastSpokeTurns(sessionId);
  const decision = await arbitrateTurn({
    targetNpcId,
    playerInput,
    scene,
    npcStates,
    lastSpokeTurns
  });

  if (decision.speakers.length === 0) {
    return {
      replies: [],
      speakerOrder: [],
      partialFailure: false,
      arbiterRationale: decision.rationale
    };
  }

  const replies: ChatReply[] = [];
  let partialFailure = false;

  for (const speaker of decision.speakers) {
    if (speaker.mode === "silent") {
      continue;
    }

    try {
      const reply = await processNpcTurn({
        sessionId,
        npcId: speaker.npcId,
        player,
        playerInput,
        scene,
        priorReplies: replies.map(({ npcId, dialogue }) => ({ npcId, dialogue })),
        applyActions: replies.length === 0,
        interactionMode: speaker.mode
      });
      replies.push({ ...reply, speakMode: speaker.mode });
    } catch (error) {
      if (replies.length === 0) {
        throw error;
      }

      partialFailure = true;
    }
  }

  if (replies.length > 0) {
    recordSpeakers(sessionId, replies.map((reply) => reply.npcId));
  }

  return {
    replies,
    speakerOrder: replies.map((reply) => reply.npcId),
    partialFailure,
    arbiterRationale: decision.rationale
  };
}
