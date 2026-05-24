import { applyStateDelta, executeIntent, getNpcState } from "./gameState.js";
import { buildEquippedPromptHints, buildEquippedTagList } from "./artifactEngine.js";
import { requestLlm } from "./llmClient.js";
import { addMemory, getRecentMemories, retrieveRelevantMemories } from "./memoryStore.js";
import { deriveEvents, evaluateRules, getPersonality, recordEvents } from "./personalityEvolution.js";
import { buildPromptMessages, mergeMemoriesForPrompt, type PriorNpcReply } from "./promptBuilder.js";
import { evaluateIntent as evaluateQuestIntent, getRelevantQuests } from "./questEngine.js";
import { validateLlmResponse } from "./responseValidator.js";
import { scopedNpcId as makeScopedNpcId } from "./scopedNpcId.js";
import { recordTurnFlags } from "./worldStateFlags.js";
import type { ChatReply, SpeakMode } from "../types/chat.js";
import type { PlayerState } from "../types/player.js";
import type { SceneSnapshot } from "../types/scene.js";

export type ProcessNpcTurnInput = {
  sessionId: string;
  npcId: string;
  player: PlayerState;
  playerInput: string;
  scene?: SceneSnapshot;
  priorReplies?: PriorNpcReply[];
  applyActions?: boolean;
  interactionMode?: SpeakMode;
};

export async function processNpcTurn({
  sessionId,
  npcId,
  player,
  playerInput,
  scene,
  priorReplies = [],
  applyActions = true,
  interactionMode
}: ProcessNpcTurnInput): Promise<ChatReply> {
  const scopedNpcId = makeScopedNpcId(sessionId, npcId);
  const [retrieved, recent] = await Promise.all([
    retrieveRelevantMemories(scopedNpcId, playerInput, 5),
    Promise.resolve(getRecentMemories(scopedNpcId, 3))
  ]);
  const memories = mergeMemoriesForPrompt(retrieved, recent);
  const activeQuests = applyActions ? getRelevantQuests(sessionId, npcId) : [];
  const evolvedTraits = getPersonality(sessionId, npcId).evolvedTraits;
  const equippedArtifactTags = buildEquippedTagList(sessionId);
  const artifactHints = buildEquippedPromptHints(sessionId, npcId);
  const rawResponse = await requestLlm({
    messages: buildPromptMessages({
      scopedNpcId,
      npcId,
      playerInput,
      memories,
      player,
      scene,
      activeQuests,
      evolvedTraits,
      priorReplies,
      speakMode: interactionMode,
      equippedArtifactTags,
      artifactHints
    }),
    playerInput,
    npcId
  });
  const npcResponse = validateLlmResponse(rawResponse);

  let dialogue = npcResponse.dialogue;
  let actions = npcResponse.actions ?? [];

  if (interactionMode === "action_only") {
    dialogue = "";
    if (actions.length === 0) {
      actions = ["*沉默*"];
    }
  }

  applyStateDelta(scopedNpcId, npcResponse.state_delta);
  const baseActionResult = applyActions ? executeIntent(scopedNpcId, npcResponse.intent) : "";
  const questResult = applyActions
    ? evaluateQuestIntent(sessionId, scopedNpcId, npcResponse.intent)
    : { actionResults: [], statusChanges: [] };
  const personalityEvents = deriveEvents(npcResponse.intent, npcResponse.state_delta, questResult.statusChanges);

  if (applyActions) {
    recordTurnFlags({
      sessionId,
      playerInput,
      intentType: npcResponse.intent.type,
      statusChanges: questResult.statusChanges
    });
  }

  if (personalityEvents.length > 0) {
    recordEvents(sessionId, npcId, personalityEvents);
    evaluateRules(sessionId, npcId);
  }

  if (npcResponse.memory) {
    await addMemory(scopedNpcId, npcResponse.memory);
  }

  return {
    npcId,
    dialogue,
    tone: npcResponse.tone,
    intent: npcResponse.intent,
    state: getNpcState(scopedNpcId),
    memoryAdded: npcResponse.memory,
    actionResult: [baseActionResult, ...questResult.actionResults].filter(Boolean).join(" / "),
    kind: "dialogue",
    actions
  };
}
