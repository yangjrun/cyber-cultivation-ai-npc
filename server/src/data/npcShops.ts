import { listNpcIds } from "./npcs.js";

export type ShopStockSeed = {
  itemId: string;
  quantity: number;
};

export type NpcShopSeed = {
  spiritStones: number;
  stock: ShopStockSeed[];
};

/**
 * 稀缺修正的回退基准库存：种子里未列出的物品按此值估算稀缺度。
 */
export const DEFAULT_REFERENCE_STOCK = 5;

/**
 * 每个 NPC 的初始商店：自有灵石 + 初始库存。
 * 按角色设定区分主营品类，价格由 tradeEngine 动态计算，这里只定数量与现金。
 */
export const npcShopSeeds: Record<string, NpcShopSeed> = {
  // 黑市炼丹师，主营丹药与炼丹材料
  baili: {
    spiritStones: 800,
    stock: [
      { itemId: "cloud_veil_pill", quantity: 3 },
      { itemId: "cheap_qi_pill", quantity: 5 },
      { itemId: "breakthrough_pill", quantity: 1 },
      { itemId: "shadow_herb", quantity: 6 },
      { itemId: "ash_salt", quantity: 4 }
    ]
  },
  // 掮客（卧底），资金充裕但货少
  suhe: {
    spiritStones: 1500,
    stock: [
      { itemId: "cheap_qi_pill", quantity: 4 },
      { itemId: "cloud_veil_pill", quantity: 2 }
    ]
  },
  // 雷罚帮打手，收赃为主、现金偏紧
  chimu: {
    spiritStones: 500,
    stock: [
      { itemId: "cheap_qi_pill", quantity: 2 },
      { itemId: "failed_dregs", quantity: 10 },
      { itemId: "ash_salt", quantity: 3 }
    ]
  },
  // 信息贩子，小批量高价稀货
  qinggu: {
    spiritStones: 1200,
    stock: [
      { itemId: "cloud_veil_pill", quantity: 2 },
      { itemId: "breakthrough_pill", quantity: 1 },
      { itemId: "shadow_herb", quantity: 3 }
    ]
  }
};

/**
 * 该 NPC 某物品的种子库存数量，用作稀缺修正的参考基准。
 * 未在种子中出现的物品回退到 DEFAULT_REFERENCE_STOCK。
 */
export function getSeedStock(npcId: string, itemId: string): number {
  const seed = npcShopSeeds[npcId];

  if (!seed) {
    return DEFAULT_REFERENCE_STOCK;
  }

  const entry = seed.stock.find((stock) => stock.itemId === itemId);
  return entry ? entry.quantity : DEFAULT_REFERENCE_STOCK;
}

/**
 * 拥有商店的 NPC id 列表（当前为全部已知 NPC）。
 */
export function listShopNpcIds(): string[] {
  return listNpcIds();
}
