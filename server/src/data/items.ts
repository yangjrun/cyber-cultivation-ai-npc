export type ItemType = "material" | "pill" | "junk" | "artifact";

export type ItemEffect =
  | { type: "restore_qi"; amount: number }
  | { type: "reduce_alert"; amount: number }
  | { type: "breakthrough_bonus"; amount: number; durationSeconds: number };

export type ItemDefinition = {
  id: string;
  name: string;
  type: ItemType;
  description: string;
  basePrice: number;
  effect?: ItemEffect;
};

export const items: Record<string, ItemDefinition> = {
  shadow_herb: {
    id: "shadow_herb",
    name: "影髓草",
    type: "material",
    description: "炼制遮云丹的主材，会吸附天道镜噪声。",
    basePrice: 18
  },
  ash_salt: {
    id: "ash_salt",
    name: "劫灰盐",
    type: "material",
    description: "雷罚残灰凝成的黑盐，火候过猛会炸炉。",
    basePrice: 22
  },
  cheap_qi_pill: {
    id: "cheap_qi_pill",
    name: "粗制回气丹",
    type: "pill",
    description: "黑市常见货，能回一点灵气。",
    basePrice: 30,
    effect: { type: "restore_qi", amount: 80 }
  },
  cloud_veil_pill: {
    id: "cloud_veil_pill",
    name: "遮云丹",
    type: "pill",
    description: "短暂压低天道镜警戒，突破前常有人赌这一口。",
    basePrice: 120,
    effect: { type: "reduce_alert", amount: 30 }
  },
  breakthrough_pill: {
    id: "breakthrough_pill",
    name: "破境丹",
    type: "pill",
    description: "提升下一次突破成功率。",
    basePrice: 420,
    effect: { type: "breakthrough_bonus", amount: 0.18, durationSeconds: 600 }
  },
  failed_dregs: {
    id: "failed_dregs",
    name: "焦黑丹渣",
    type: "junk",
    description: "炼废后的渣子，闻起来像欠债。",
    basePrice: 3
  },
  fentian_ling: {
    id: "fentian_ling",
    name: "焚天令",
    type: "artifact",
    description: "白璃丹炉炼炉用的旧令牌。装备后,白璃的语气会软三分。",
    basePrice: 900
  },
  mieshen_zhen: {
    id: "mieshen_zhen",
    name: "灭神针",
    type: "artifact",
    description: "从监察密钥上拆下的反制构件。装备后,你在监察相关 NPC 面前更敢出声。",
    basePrice: 1600
  },
  yinggu_fu: {
    id: "yinggu_fu",
    name: "影骨符",
    type: "artifact",
    description: "金丹后期才碰得到的尸骨符。装备后,自身灵压对天道镜更隐形。",
    basePrice: 2400
  }
};

export const starterInventory = [
  { itemId: "shadow_herb", quantity: 3 },
  { itemId: "ash_salt", quantity: 2 },
  { itemId: "cheap_qi_pill", quantity: 1 },
  { itemId: "cloud_veil_pill", quantity: 1 }
] as const;

export function getItemDefinition(itemId: string): ItemDefinition | null {
  return items[itemId] ?? null;
}
