export type NpcMood = {
  trust: number;
  fear: number;
  anger: number;
};

export type PriceInputs = {
  basePrice: number;
  npcMood: NpcMood;
  /** NPC 当前持有该物品数量 */
  npcStock: number;
  /** 稀缺基准（种子库存或回退值） */
  referenceStock: number;
  /** 玩家境界索引 0..14 */
  cultivationStageIdx: number;
};

export type ItemQuality = "common" | "fine" | "perfect";

export type TradeRefusal = {
  refused: boolean;
  reason?: string;
};

const REFUSE_THRESHOLD = 80;

/**
 * 怒气或恐惧过高时 NPC 拒绝任何交易。
 */
export function isTradeRefused(mood: NpcMood): TradeRefusal {
  if (mood.anger >= REFUSE_THRESHOLD) {
    return { refused: true, reason: "对方怒气冲天，根本不愿与你交易。" };
  }

  if (mood.fear >= REFUSE_THRESHOLD) {
    return { refused: true, reason: "对方满脸戒惧，借故推脱了这桩买卖。" };
  }

  return { refused: false };
}

/**
 * 玩家向 NPC 买入的单价。
 * 最终价 = 基准价 × 关系修正 × 稀缺修正 × 实力修正。
 */
export function computeBuyUnitPrice(inputs: PriceInputs): number {
  const { basePrice, npcMood, npcStock, referenceStock, cultivationStageIdx } = inputs;

  const relation = clamp(1 - 0.003 * npcMood.trust + 0.005 * npcMood.anger + 0.003 * npcMood.fear, 0.6, 2.0);
  const scarcity = clamp(1 + (referenceStock - npcStock) * 0.06, 0.8, 1.8);
  const power = clamp(1 - cultivationStageIdx * 0.01, 0.86, 1.0);

  return Math.max(1, Math.round(basePrice * relation * scarcity * power));
}

/**
 * 玩家卖给 NPC 的单价。买价恒 ≥ 卖价，杜绝套利。
 * @param quality 物品品质（炼丹品质），影响最终售价
 */
export function computeSellUnitPrice(inputs: PriceInputs, quality?: ItemQuality): number {
  const { basePrice, npcMood, npcStock, cultivationStageIdx } = inputs;

  const relation = clamp(1 + 0.003 * npcMood.trust - 0.004 * npcMood.anger - 0.002 * npcMood.fear, 0.4, 1.3);
  const scarcity = clamp(1 - npcStock * 0.05, 0.5, 1.1);
  const power = clamp(1 + cultivationStageIdx * 0.008, 1.0, 1.12);
  const qualityMultiplier = getQualityMultiplier(quality);

  const sellRaw = Math.max(1, Math.round(basePrice * relation * scarcity * power * qualityMultiplier));
  const sellCap = Math.round(basePrice * 1.5);

  return Math.max(1, Math.min(sellRaw, sellCap));
}

/**
 * 获取品质加成倍率
 */
export function getQualityMultiplier(quality?: ItemQuality): number {
  if (!quality) return 1.0;

  switch (quality) {
    case "perfect":
      return 1.4;
    case "fine":
      return 1.15;
    case "common":
      return 1.0;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
