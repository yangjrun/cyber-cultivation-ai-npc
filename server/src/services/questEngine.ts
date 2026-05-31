import { getQuestDefinition, listQuestIds } from "../data/quests.js";
import { applyStateDelta, getNpcState } from "./gameState.js";
import { addItem } from "./inventoryStore.js";
import { applyRelationDelta } from "./npcRelationsStore.js";
import { getPlayer, updatePlayer } from "./playerStore.js";
import { getAllQuestProgressForSession, getQuestProgress, upsertQuestProgress } from "./questStore.js";
import { evaluateRepeatableAvailability } from "./questCooldown.js";
import { parseScopedNpcId, scopedNpcId } from "./scopedNpcId.js";
import type { NpcIntent } from "../types/npc.js";
import type { QuestDefinition, QuestEffect, QuestProgress, QuestStatus, QuestTrigger } from "../types/quest.js";

export class QuestStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestStateError";
  }
}

export type QuestStatusChange = {
  questId: string;
  from: QuestStatus;
  to: QuestStatus;
};

export type QuestEvaluation = {
  actionResults: string[];
  effectsApplied: QuestEffect[];
  statusChanges: QuestStatusChange[];
};

const TERMINAL_STATUSES: ReadonlySet<QuestStatus> = new Set<QuestStatus>(["completed", "failed"]);

export function evaluateIntent(
  sessionId: string,
  scopedNpc: string,
  intent: NpcIntent
): QuestEvaluation {
  const { baseNpcId } = parseScopedNpcId(scopedNpc);
  const evaluation: QuestEvaluation = {
    actionResults: [],
    effectsApplied: [],
    statusChanges: []
  };

  for (const questId of listQuestIds()) {
    const definition = getQuestDefinition(questId);

    if (!definition) {
      continue;
    }

    processQuest(sessionId, baseNpcId, intent, definition, evaluation);
  }

  return evaluation;
}

export function getRelevantQuests(sessionId: string, npcId: string): QuestProgress[] {
  const all = getAllQuestProgressForSession(sessionId);
  return all.filter((progress) => {
    const definition = getQuestDefinition(progress.questId);
    return definition !== null && (definition.giverNpcId === npcId || definition.involvedNpcIds.includes(npcId));
  });
}

export function markQuestFlag(
  sessionId: string,
  questId: string,
  key: string,
  value: unknown
): QuestProgress {
  const definition = getQuestDefinition(questId);

  if (!definition) {
    throw new QuestStateError(`Unknown quest: ${questId}`);
  }

  const current = getQuestProgress(sessionId, questId);

  if (!current) {
    throw new QuestStateError(`Quest not accepted: ${questId}`);
  }

  if (TERMINAL_STATUSES.has(current.status)) {
    throw new QuestStateError(`Cannot modify terminal quest: ${questId}`);
  }

  const nextProgress = { ...current.progress, [key]: value };

  return upsertQuestProgress({
    sessionId,
    questId,
    status: current.status,
    progress: nextProgress,
    acceptedAt: current.acceptedAt,
    completedAt: current.completedAt
  });
}

function processQuest(
  sessionId: string,
  baseNpcId: string,
  intent: NpcIntent,
  definition: QuestDefinition,
  evaluation: QuestEvaluation
): void {
  const current = getQuestProgress(sessionId, definition.questId);
  const status: QuestStatus = current?.status ?? "available";

  if (TERMINAL_STATUSES.has(status)) {
    // Repeatable quests may be re-accepted once their cooldown elapses.
    const availability = evaluateRepeatableAvailability(definition, current);

    if (availability.canAccept) {
      tryAcceptQuest(sessionId, baseNpcId, intent, definition, evaluation);
    }

    return;
  }

  if (status === "available") {
    tryAcceptQuest(sessionId, baseNpcId, intent, definition, evaluation);
    return;
  }

  // Handle complete_quest_objective intent
  if (intent.type === "complete_quest_objective" &&
      intent.params.quest_id === definition.questId &&
      typeof intent.params.flag_key === "string") {
    const flagKey = intent.params.flag_key as string;
    const updatedProgress = markQuestFlag(sessionId, definition.questId, flagKey, true);

    if (status === "accepted") {
      const progressed = transitionToInProgress(sessionId, updatedProgress);
      evaluation.statusChanges.push({ questId: definition.questId, from: "accepted", to: "in_progress" });
      checkCompletionAndFailure(sessionId, baseNpcId, intent, definition, progressed, evaluation);
      return;
    }

    if (status === "in_progress") {
      checkCompletionAndFailure(sessionId, baseNpcId, intent, definition, updatedProgress, evaluation);
      return;
    }
  }

  if (status === "accepted") {
    const progressed = transitionToInProgress(sessionId, current);
    evaluation.statusChanges.push({ questId: definition.questId, from: "accepted", to: "in_progress" });
    checkCompletionAndFailure(sessionId, baseNpcId, intent, definition, progressed, evaluation);
    return;
  }

  if (status === "in_progress") {
    checkCompletionAndFailure(sessionId, baseNpcId, intent, definition, current!, evaluation);
  }
}

function tryAcceptQuest(
  sessionId: string,
  baseNpcId: string,
  intent: NpcIntent,
  definition: QuestDefinition,
  evaluation: QuestEvaluation
): void {
  if (intent.type !== definition.acceptableViaIntent) {
    return;
  }

  if (definition.giverNpcId !== baseNpcId) {
    return;
  }

  if (intent.type === "give_quest" && intent.params.quest_id !== definition.questId) {
    return;
  }

  const acceptedAt = new Date().toISOString();
  const progress = upsertQuestProgress({
    sessionId,
    questId: definition.questId,
    status: "accepted",
    progress: {},
    acceptedAt,
    completedAt: null
  });

  evaluation.statusChanges.push({ questId: definition.questId, from: "available", to: "accepted" });
  evaluation.actionResults.push(`接受任务：${definition.title}`);
  applyEffectsList(sessionId, definition.questId, definition.effectsOnAccept, progress, evaluation);
}

function transitionToInProgress(sessionId: string, current: QuestProgress | null): QuestProgress {
  if (!current) {
    throw new QuestStateError("Cannot transition non-existent quest progress to in_progress");
  }

  const next = upsertQuestProgress({
    sessionId,
    questId: current.questId,
    status: "in_progress",
    progress: current.progress,
    acceptedAt: current.acceptedAt,
    completedAt: null
  });

  return next;
}

function checkCompletionAndFailure(
  sessionId: string,
  baseNpcId: string,
  intent: NpcIntent,
  definition: QuestDefinition,
  current: QuestProgress,
  evaluation: QuestEvaluation
): void {
  const failureMatched = definition.failureTriggers.some((trigger) =>
    triggerMatches(trigger, sessionId, baseNpcId, intent, current.progress)
  );

  if (failureMatched) {
    const failed = upsertQuestProgress({
      sessionId,
      questId: definition.questId,
      status: "failed",
      progress: current.progress,
      acceptedAt: current.acceptedAt,
      completedAt: new Date().toISOString()
    });
    evaluation.statusChanges.push({ questId: definition.questId, from: "in_progress", to: "failed" });
    evaluation.actionResults.push(`任务失败：${definition.title}`);
    applyEffectsList(sessionId, definition.questId, definition.effectsOnFail, failed, evaluation);
    return;
  }

  const completionMatched = definition.completionTriggers.some((trigger) =>
    triggerMatches(trigger, sessionId, baseNpcId, intent, current.progress)
  );

  if (completionMatched) {
    const completed = upsertQuestProgress({
      sessionId,
      questId: definition.questId,
      status: "completed",
      progress: current.progress,
      acceptedAt: current.acceptedAt,
      completedAt: new Date().toISOString()
    });
    evaluation.statusChanges.push({ questId: definition.questId, from: "in_progress", to: "completed" });
    evaluation.actionResults.push(`完成任务：${definition.title}`);
    applyEffectsList(sessionId, definition.questId, definition.effectsOnComplete, completed, evaluation);
  }
}

function triggerMatches(
  trigger: QuestTrigger,
  sessionId: string,
  baseNpcId: string,
  intent: NpcIntent,
  progress: Record<string, unknown>
): boolean {
  if (trigger.kind === "intent") {
    return intent.type === trigger.intentType && trigger.npcId === baseNpcId;
  }

  if (trigger.kind === "flag") {
    return progress[trigger.key] === trigger.expectedValue;
  }

  if (trigger.kind === "npc_state_threshold") {
    const state = getNpcState(scopedNpcId(sessionId, trigger.npcId));
    const value = state[trigger.field];

    if (trigger.op === ">=") {
      return value >= trigger.value;
    }

    if (trigger.op === "<=") {
      return value <= trigger.value;
    }
  }

  return false;
}

function applyEffectsList(
  sessionId: string,
  questId: string,
  effects: QuestEffect[],
  progress: QuestProgress,
  evaluation: QuestEvaluation
): void {
  let workingProgress = progress.progress;
  let progressChanged = false;

  for (const effect of effects) {
    if (effect.kind === "npc_state_delta") {
      const scoped = scopedNpcId(sessionId, effect.npcId);
      applyStateDelta(scoped, {
        trust: effect.delta.trust ?? 0,
        fear: effect.delta.fear ?? 0,
        anger: effect.delta.anger ?? 0,
        tianDaoAlert: effect.delta.tianDaoAlert ?? 0
      });
      evaluation.actionResults.push(`${effect.npcId} 情绪变动`);
    } else if (effect.kind === "relation_delta") {
      applyRelationDelta(sessionId, effect.from, effect.to, {
        trust: effect.trust,
        hostility: effect.hostility
      });
    } else if (effect.kind === "give_item") {
      addItem(sessionId, effect.itemId, effect.quantity);
      evaluation.actionResults.push(`获得物品 ${effect.itemId} x${effect.quantity}`);
    } else if (effect.kind === "give_stones") {
      const player = getPlayer(sessionId);

      if (player) {
        updatePlayer(sessionId, { spiritStones: player.spiritStones + effect.amount });
        evaluation.actionResults.push(`获得 ${effect.amount} 灵石`);
      }
    } else if (effect.kind === "set_flag") {
      workingProgress = { ...workingProgress, [effect.key]: effect.value };
      progressChanged = true;
    }

    evaluation.effectsApplied.push(effect);
  }

  if (progressChanged) {
    upsertQuestProgress({
      sessionId,
      questId,
      status: progress.status,
      progress: workingProgress,
      acceptedAt: progress.acceptedAt,
      completedAt: progress.completedAt
    });
  }
}
