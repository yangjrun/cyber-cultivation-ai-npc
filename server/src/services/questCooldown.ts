import type { QuestDefinition, QuestProgress } from "../types/quest.js";

const DEFAULT_COOLDOWN_HOURS = 48;

export type RepeatableAvailability = {
  canAccept: boolean;
  reason?: string;
  availableAt?: string;
};

/**
 * Determine whether a repeatable quest can be re-accepted given its last completion.
 * Non-repeatable quests in a terminal state can never be re-accepted.
 */
export function evaluateRepeatableAvailability(
  definition: QuestDefinition,
  progress: QuestProgress | null,
  now: Date = new Date()
): RepeatableAvailability {
  // No prior progress = freely acceptable
  if (!progress) {
    return { canAccept: true };
  }

  // Non-terminal states are handled by the normal state machine
  if (progress.status !== "completed" && progress.status !== "failed") {
    return { canAccept: true };
  }

  // Terminal, non-repeatable quest stays closed
  if (!definition.repeatable) {
    return { canAccept: false, reason: "任务已结束，不可重复。" };
  }

  // Repeatable but failed: allow immediate retry (no cooldown on failure)
  if (progress.status === "failed") {
    return { canAccept: true };
  }

  // Repeatable + completed: enforce cooldown from completedAt
  const cooldownHours = definition.cooldownHours ?? DEFAULT_COOLDOWN_HOURS;

  if (!progress.completedAt) {
    return { canAccept: true };
  }

  const completedAt = new Date(progress.completedAt);
  const availableAt = new Date(completedAt.getTime() + cooldownHours * 60 * 60 * 1000);

  if (now.getTime() >= availableAt.getTime()) {
    return { canAccept: true };
  }

  return {
    canAccept: false,
    reason: "委托冷却中，暂时无法再次接取。",
    availableAt: availableAt.toISOString()
  };
}

/**
 * Compute when a completed repeatable quest becomes available again.
 * Returns null if not applicable (not repeatable, not completed, or no completion time).
 */
export function computeNextAvailableAt(
  definition: QuestDefinition,
  progress: QuestProgress | null
): string | null {
  if (!definition.repeatable || !progress || progress.status !== "completed" || !progress.completedAt) {
    return null;
  }

  const cooldownHours = definition.cooldownHours ?? DEFAULT_COOLDOWN_HOURS;
  const completedAt = new Date(progress.completedAt);
  return new Date(completedAt.getTime() + cooldownHours * 60 * 60 * 1000).toISOString();
}
