import { dailyPassiveIncome, passiveIncomeConfig } from "../data/passiveIncome.js";

export type PassiveIncomeClaim = {
  /** 本次发放的灵石总数 */
  amount: number;
  /** 结算的天数 */
  daysAccrued: number;
  /** 新的"上次领取时间" ISO 字符串（用于持久化） */
  newClaimedAt: string;
  /** 是否真的发放了灵石 */
  claimed: boolean;
  message: string;
};

/**
 * 计算一次被动收入领取。
 * @param cultivationStageIdx 玩家境界索引
 * @param lastClaimedAt 上次领取时间（null 表示从未领取，以 now 为起点不发放）
 * @param now 当前时间
 */
export function calculatePassiveIncome(
  cultivationStageIdx: number,
  lastClaimedAt: string | null,
  now: Date = new Date()
): PassiveIncomeClaim {
  const perDay = dailyPassiveIncome(cultivationStageIdx);
  const nowIso = now.toISOString();

  // 练气期或更低：没有被动收入，但仍推进 claim 锚点
  if (perDay <= 0) {
    return {
      amount: 0,
      daysAccrued: 0,
      newClaimedAt: lastClaimedAt ?? nowIso,
      claimed: false,
      message: "练气期还凝聚不出灵石，先突破筑基吧。"
    };
  }

  // 首次领取：设锚点，不发放（避免新号瞬间领满）
  if (!lastClaimedAt) {
    return {
      amount: 0,
      daysAccrued: 0,
      newClaimedAt: nowIso,
      claimed: false,
      message: "已开始凝聚灵石，明日再来领取。"
    };
  }

  const periodMs = passiveIncomeConfig.accrualPeriodHours * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - new Date(lastClaimedAt).getTime();
  const fullDays = Math.floor(elapsedMs / periodMs);

  if (fullDays <= 0) {
    return {
      amount: 0,
      daysAccrued: 0,
      newClaimedAt: lastClaimedAt,
      claimed: false,
      message: "灵石尚未凝聚成形，过些时辰再来。"
    };
  }

  const daysAccrued = Math.min(fullDays, passiveIncomeConfig.maxAccrualDays);
  const amount = daysAccrued * perDay;

  // 推进锚点：只消费已结算的整天数，余下零头保留
  const consumedMs = daysAccrued * periodMs;
  const newClaimedAt = new Date(new Date(lastClaimedAt).getTime() + consumedMs).toISOString();

  return {
    amount,
    daysAccrued,
    newClaimedAt,
    claimed: true,
    message: `凝聚了 ${daysAccrued} 日灵气，入账 ${amount} 灵石。`
  };
}
