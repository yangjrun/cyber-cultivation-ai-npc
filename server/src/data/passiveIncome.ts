import { getStageByIndex } from "./cultivationBalance.js";

/**
 * 境界被动收入（凝聚灵石）配置。
 * 练气期没有被动收入；筑基期起按境界递增，奖励长期玩家。
 * 数值刻意压低：被动收入是锦上添花，不能替代采集/炼丹/委托等主动玩法。
 */
export const passiveIncomeConfig = {
  /** 每次领取累计的最大天数，防止长期挂机一次性暴富 */
  maxAccrualDays: 7,
  /** 领取冷却（小时）：每 24 小时结算一份 */
  accrualPeriodHours: 24
} as const;

/**
 * 按境界索引返回每日凝聚的灵石数。练气期（idx 0-8）为 0。
 */
export function dailyPassiveIncome(cultivationStageIdx: number): number {
  const stage = getStageByIndex(cultivationStageIdx);

  switch (stage.realm) {
    case "筑基期":
      // 筑基初期 5 / 中期 8 / 后期 12
      if (cultivationStageIdx === 9) return 5;
      if (cultivationStageIdx === 10) return 8;
      return 12;
    case "金丹期":
      // 金丹初期 20 / 中期 28 / 后期 36
      if (cultivationStageIdx === 12) return 20;
      if (cultivationStageIdx === 13) return 28;
      return 36;
    default:
      return 0; // 练气期及未知境界
  }
}
