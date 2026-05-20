import type { ElementRoots, RootElement } from "../types/player.js";

export type CultivationStage = {
  idx: number;
  label: string;
  realm: string;
  qiCap: number;
  baseSuccessRate: number;
  alertPenaltyPerPoint: number;
};

export const rootElements: RootElement[] = ["metal", "wood", "water", "fire", "earth"];

export const rootLabels: Record<RootElement, string> = {
  metal: "金",
  wood: "木",
  water: "水",
  fire: "火",
  earth: "土"
};

export const defaultRoots: ElementRoots = {
  metal: 70,
  wood: 40,
  water: 12,
  fire: 8,
  earth: 16
};

export const cultivationStages: CultivationStage[] = [
  { idx: 0, label: "练气一层", realm: "练气期", qiCap: 100, baseSuccessRate: 0.9, alertPenaltyPerPoint: 0.003 },
  { idx: 1, label: "练气二层", realm: "练气期", qiCap: 130, baseSuccessRate: 0.86, alertPenaltyPerPoint: 0.003 },
  { idx: 2, label: "练气三层", realm: "练气期", qiCap: 170, baseSuccessRate: 0.82, alertPenaltyPerPoint: 0.003 },
  { idx: 3, label: "练气四层", realm: "练气期", qiCap: 220, baseSuccessRate: 0.78, alertPenaltyPerPoint: 0.0035 },
  { idx: 4, label: "练气五层", realm: "练气期", qiCap: 280, baseSuccessRate: 0.74, alertPenaltyPerPoint: 0.0035 },
  { idx: 5, label: "练气六层", realm: "练气期", qiCap: 350, baseSuccessRate: 0.7, alertPenaltyPerPoint: 0.004 },
  { idx: 6, label: "练气七层", realm: "练气期", qiCap: 430, baseSuccessRate: 0.66, alertPenaltyPerPoint: 0.004 },
  { idx: 7, label: "练气八层", realm: "练气期", qiCap: 520, baseSuccessRate: 0.62, alertPenaltyPerPoint: 0.0045 },
  { idx: 8, label: "练气九层", realm: "练气期", qiCap: 620, baseSuccessRate: 0.58, alertPenaltyPerPoint: 0.0045 },
  { idx: 9, label: "筑基初期", realm: "筑基期", qiCap: 760, baseSuccessRate: 0.52, alertPenaltyPerPoint: 0.005 },
  { idx: 10, label: "筑基中期", realm: "筑基期", qiCap: 920, baseSuccessRate: 0.48, alertPenaltyPerPoint: 0.005 },
  { idx: 11, label: "筑基后期", realm: "筑基期", qiCap: 1100, baseSuccessRate: 0.44, alertPenaltyPerPoint: 0.0055 },
  { idx: 12, label: "金丹初期", realm: "金丹期", qiCap: 1400, baseSuccessRate: 0.38, alertPenaltyPerPoint: 0.006 },
  { idx: 13, label: "金丹中期", realm: "金丹期", qiCap: 1700, baseSuccessRate: 0.34, alertPenaltyPerPoint: 0.006 },
  { idx: 14, label: "金丹后期", realm: "金丹期", qiCap: 2100, baseSuccessRate: 0.3, alertPenaltyPerPoint: 0.0065 }
];

export const phaseTwoMaxStageIdx = 12;

export const cultivationBalance = {
  baseQiPerSecond: 1.2,
  maxCultivationDurationSeconds: 300,
  breakthroughQiFailurePenaltyRate: 0.35,
  highAlertThreshold: 70,
  minimumSuccessRate: 0.05,
  maximumSuccessRate: 0.95
} as const;

export function getStageByIndex(index: number): CultivationStage {
  return cultivationStages[index] ?? cultivationStages[0];
}
