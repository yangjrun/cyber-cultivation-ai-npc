export type PlayerTraitId = "yiti_arm" | "leifa_scar" | "feifagen";

export type PlayerTrait = {
  id: PlayerTraitId;
  name: string;
  description: string;
  visibleTraits: string[];
  recentActions: string[];
};

const TRAITS: Record<PlayerTraitId, PlayerTrait> = {
  yiti_arm: {
    id: "yiti_arm",
    name: "右臂义体",
    description: "义体接驳点泄漏微弱金属共鸣，能撕开符纸但被天道云持续标记。",
    visibleTraits: ["右臂义体", "金属共鸣残响"],
    recentActions: ["在监察院流水线偷换过义体核心"]
  },
  leifa_scar: {
    id: "leifa_scar",
    name: "雷罚残痕",
    description: "未死透的雷罚在心脉上烧出了灼痕；筑基难，破境时易引来二次劫。",
    visibleTraits: ["雷罚残痕", "焚天体质"],
    recentActions: ["在雷罚帮的祭台上活过了一夜"]
  },
  feifagen: {
    id: "feifagen",
    name: "非法灵根",
    description: "灵根波形被天道云列为禁用频谱；普通灵气吸收效率低，但能用废管邪气。",
    visibleTraits: ["非法灵根波形"],
    recentActions: ["把灵根波形伪装成义体噪音躲过监察"]
  }
};

export function getPlayerTrait(id: PlayerTraitId): PlayerTrait {
  return TRAITS[id];
}

export function listPlayerTraits(): PlayerTrait[] {
  return Object.values(TRAITS);
}

export function isPlayerTraitId(value: unknown): value is PlayerTraitId {
  return typeof value === "string" && value in TRAITS;
}
