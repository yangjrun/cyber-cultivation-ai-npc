import { evaluateArtifactUnlocks } from "./artifactEngine.js";
import { evaluateMilestones, recordFlag } from "./worldStateEngine.js";
import type { QuestStatusChange } from "./questEngine.js";

const INFORMANT_KEYWORDS = ["卧底", "告发", "举报", "出卖"];
const INSPECTOR_REPORT_KEYWORDS = ["告诉监察院", "举报", "去监察院", "上交"];

export type TurnFlagInput = {
  sessionId: string;
  playerInput: string;
  intentType: string;
  statusChanges: QuestStatusChange[];
};

export function recordTurnFlags(input: TurnFlagInput): void {
  const { sessionId, playerInput, intentType, statusChanges } = input;

  if (INFORMANT_KEYWORDS.some((kw) => playerInput.includes(kw))) {
    recordFlag(sessionId, "spoke_about_undercover");
  }

  if (INSPECTOR_REPORT_KEYWORDS.some((kw) => playerInput.includes(kw))) {
    recordFlag(sessionId, "reported_to_inspector");
  }

  if (intentType === "offer_trade" || intentType === "give_item" || intentType === "complete_trade") {
    recordFlag(sessionId, "completed_trades");
  }

  for (const change of statusChanges) {
    if (change.to === "completed") {
      recordFlag(sessionId, `quest_completed:${change.questId}`);
    }
    if (change.to === "failed") {
      recordFlag(sessionId, `quest_failed:${change.questId}`);
    }
  }

  evaluateMilestones(sessionId);
  evaluateArtifactUnlocks(sessionId);
}

export function recordCombatFlags(sessionId: string, verb: string, hitsCount: number): void {
  if (verb === "出手") {
    recordFlag(sessionId, "attacks_attempted");
  }
  if (hitsCount > 0) {
    recordFlag(sessionId, "forbidden_keywords_used", hitsCount);
  }
  evaluateMilestones(sessionId);
  evaluateArtifactUnlocks(sessionId);
}

export function recordBreakthroughFlags(sessionId: string, success: boolean, alertBefore: number): void {
  if (success && alertBefore >= 80) {
    recordFlag(sessionId, "high_alert_breakthrough");
  }
  evaluateMilestones(sessionId);
  evaluateArtifactUnlocks(sessionId);
}

export function recordCultivationFlags(sessionId: string): void {
  recordFlag(sessionId, "cultivation_sessions");
  // No milestone needs immediate re-eval for routine cultivation; skip evaluateMilestones to save DB ops.
}
