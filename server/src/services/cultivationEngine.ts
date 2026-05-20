import { cultivationBalance, getStageByIndex, phaseTwoMaxStageIdx, type CultivationStage } from "../data/cultivationBalance.js";
import { getTechnique } from "../data/techniques.js";
import type { PlayerState, RootElement } from "../types/player.js";

export type CultivationGainResult = {
  qiGained: number;
  durationAccepted: number;
  qiCurrent: number;
  message: string;
};

export type BreakthroughResult = {
  success: boolean;
  qiCurrent: number;
  qiCap: number;
  cultivationStageIdx: number;
  realm: string;
  stageLabel: string;
  successRate: number;
  riskLevel: "low" | "medium" | "high";
  alertDelta: number;
  message: string;
};

export function calculateCultivationGain(player: PlayerState, durationSeconds: number): CultivationGainResult {
  const durationAccepted = clamp(Math.trunc(durationSeconds), 1, cultivationBalance.maxCultivationDurationSeconds);
  const technique = getTechnique(player.activeTechniqueId);
  const affinity = calculateRootAffinity(player, technique.rootWeights);
  const rawGain = durationAccepted * cultivationBalance.baseQiPerSecond * technique.multiplier * affinity;
  const qiGained = Math.max(0, Math.floor(rawGain));
  const qiCurrent = Math.min(player.qiCap, player.qiCurrent + qiGained);

  return {
    qiGained: qiCurrent - player.qiCurrent,
    durationAccepted,
    qiCurrent,
    message: qiCurrent >= player.qiCap ? "灵气已满，可以尝试突破。" : `打坐完成，灵气增长 ${qiCurrent - player.qiCurrent}。`
  };
}

export function calculateBreakthrough(player: PlayerState, tianDaoAlert: number, random = Math.random): BreakthroughResult {
  const currentStage = getStageByIndex(player.cultivationStageIdx);

  if (player.qiCurrent < player.qiCap) {
    return blockedResult(player, currentStage, "灵气未满，强行突破只会炸经脉。", tianDaoAlert);
  }

  if (player.cultivationStageIdx >= phaseTwoMaxStageIdx) {
    return blockedResult(player, currentStage, "当前 demo 最高开放到金丹初期。", tianDaoAlert);
  }

  const nextStage = getStageByIndex(player.cultivationStageIdx + 1);
  const bonus = hasActiveBonus(player.breakthroughBonusUntil) ? 0.18 : 0;
  const successRate = clamp(
    currentStage.baseSuccessRate - tianDaoAlert * currentStage.alertPenaltyPerPoint + bonus,
    cultivationBalance.minimumSuccessRate,
    cultivationBalance.maximumSuccessRate
  );
  const riskLevel = getRiskLevel(tianDaoAlert);
  const success = random() <= successRate;

  if (success) {
    return {
      success: true,
      qiCurrent: 0,
      qiCap: nextStage.qiCap,
      cultivationStageIdx: nextStage.idx,
      realm: nextStage.realm,
      stageLabel: nextStage.label,
      successRate,
      riskLevel,
      alertDelta: riskLevel === "high" ? 5 : 0,
      message: `突破成功，境界提升至${nextStage.label}。`
    };
  }

  const qiPenalty = Math.ceil(player.qiCap * cultivationBalance.breakthroughQiFailurePenaltyRate);
  return {
    success: false,
    qiCurrent: Math.max(0, player.qiCurrent - qiPenalty),
    qiCap: player.qiCap,
    cultivationStageIdx: player.cultivationStageIdx,
    realm: player.realm,
    stageLabel: currentStage.label,
    successRate,
    riskLevel,
    alertDelta: riskLevel === "high" ? 10 : 3,
    message: riskLevel === "high" ? "天道云锁定了你的灵压，雷罚反噬，突破失败。" : "气机差了一线，突破失败。"
  };
}

export { getStageByIndex };

function blockedResult(player: PlayerState, stage: CultivationStage, message: string, tianDaoAlert: number): BreakthroughResult {
  return {
    success: false,
    qiCurrent: player.qiCurrent,
    qiCap: player.qiCap,
    cultivationStageIdx: player.cultivationStageIdx,
    realm: player.realm,
    stageLabel: stage.label,
    successRate: 0,
    riskLevel: getRiskLevel(tianDaoAlert),
    alertDelta: 0,
    message
  };
}

function calculateRootAffinity(player: PlayerState, weights: Record<RootElement, number>): number {
  const weightedScore = Object.entries(weights).reduce((total, [element, weight]) => {
    return total + player.roots[element as RootElement] * weight;
  }, 0);

  return 0.75 + weightedScore / 100;
}

function getRiskLevel(tianDaoAlert: number): BreakthroughResult["riskLevel"] {
  if (tianDaoAlert >= 70) {
    return "high";
  }

  if (tianDaoAlert >= 40) {
    return "medium";
  }

  return "low";
}

function hasActiveBonus(until: string | null): boolean {
  return Boolean(until && Date.parse(until) > Date.now());
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
