import { npcShopSeeds } from "../data/npcShops.js";
import { getDb } from "../db/connection.js";

export type ShopStock = {
  itemId: string;
  quantity: number;
};

type ShopBalanceRow = {
  spirit_stones: number;
};

type ShopStockRow = {
  item_id: string;
  quantity: number;
};

/**
 * 为新 session 初始化每个 NPC 的商店余额与库存。
 * 自带内部事务（仿 npcRelationsStore），必须在 createSession 主事务之后调用。
 */
export function initializeShopsForSession(sessionId: string): void {
  const db = getDb();
  const updatedAt = new Date().toISOString();

  const insertShop = db.prepare(
    `INSERT OR IGNORE INTO npc_shops (session_id, npc_id, spirit_stones, updated_at)
     VALUES (?, ?, ?, ?)`
  );
  const insertStock = db.prepare(
    `INSERT OR IGNORE INTO npc_shop_items (session_id, npc_id, item_id, quantity, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  );

  db.transaction(() => {
    for (const [npcId, seed] of Object.entries(npcShopSeeds)) {
      insertShop.run(sessionId, npcId, seed.spiritStones, updatedAt);
      for (const stock of seed.stock) {
        insertStock.run(sessionId, npcId, stock.itemId, stock.quantity, updatedAt);
      }
    }
  })();
}

export function getShopBalance(sessionId: string, npcId: string): number {
  const row = getDb()
    .prepare("SELECT spirit_stones FROM npc_shops WHERE session_id = ? AND npc_id = ?")
    .get(sessionId, npcId) as ShopBalanceRow | undefined;

  return row?.spirit_stones ?? 0;
}

export function getShopStock(sessionId: string, npcId: string): ShopStock[] {
  const rows = getDb()
    .prepare(
      `SELECT item_id, quantity FROM npc_shop_items
       WHERE session_id = ? AND npc_id = ? AND quantity > 0
       ORDER BY item_id ASC`
    )
    .all(sessionId, npcId) as ShopStockRow[];

  return rows.map((row) => ({ itemId: row.item_id, quantity: row.quantity }));
}

export function getShopItemQuantity(sessionId: string, npcId: string, itemId: string): number {
  const row = getDb()
    .prepare("SELECT quantity FROM npc_shop_items WHERE session_id = ? AND npc_id = ? AND item_id = ?")
    .get(sessionId, npcId, itemId) as { quantity: number } | undefined;

  return row?.quantity ?? 0;
}

/**
 * 调整 NPC 某物品库存（delta 可正可负），并清除归零行。
 */
export function adjustShopStock(sessionId: string, npcId: string, itemId: string, delta: number): void {
  const normalized = Math.trunc(delta);

  if (normalized === 0) {
    return;
  }

  const db = getDb();
  const updatedAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO npc_shop_items (session_id, npc_id, item_id, quantity, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(session_id, npc_id, item_id) DO UPDATE SET
       quantity = npc_shop_items.quantity + excluded.quantity,
       updated_at = excluded.updated_at`
  ).run(sessionId, npcId, itemId, normalized, updatedAt);

  db.prepare(
    "DELETE FROM npc_shop_items WHERE session_id = ? AND npc_id = ? AND quantity <= 0"
  ).run(sessionId, npcId);
}

/**
 * 调整 NPC 灵石余额（delta 可正可负），下限 0。
 */
export function adjustShopBalance(sessionId: string, npcId: string, delta: number): number {
  const current = getShopBalance(sessionId, npcId);
  const next = Math.max(0, current + Math.trunc(delta));
  const updatedAt = new Date().toISOString();

  getDb()
    .prepare(
      `INSERT INTO npc_shops (session_id, npc_id, spirit_stones, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id, npc_id) DO UPDATE SET
         spirit_stones = excluded.spirit_stones,
         updated_at = excluded.updated_at`
    )
    .run(sessionId, npcId, next, updatedAt);

  return next;
}

export function clearShopsForTests(): void {
  const db = getDb();
  db.prepare("DELETE FROM npc_shop_items").run();
  db.prepare("DELETE FROM npc_shops").run();
}

/**
 * 检查 NPC 商店余额是否需要恢复（24 小时冷却）。
 */
export function shouldRegenerateBalance(sessionId: string, npcId: string): boolean {
  const row = getDb()
    .prepare("SELECT last_regenerated_at FROM shop_balance_regeneration WHERE session_id = ? AND npc_id = ?")
    .get(sessionId, npcId) as { last_regenerated_at: string } | undefined;

  if (!row) {
    return true;
  }

  const lastRegen = new Date(row.last_regenerated_at);
  const now = new Date();
  const hoursSince = (now.getTime() - lastRegen.getTime()) / (1000 * 60 * 60);

  return hoursSince >= 24;
}

/**
 * 恢复 NPC 商店余额到至少初始值，并记录恢复时间。
 * 只补不削：若 NPC 因玩家购货而余额高于初始值，保留较高值。
 */
export function regenerateShopBalance(sessionId: string, npcId: string): void {
  const seed = npcShopSeeds[npcId];

  if (!seed) {
    return;
  }

  const now = new Date().toISOString();
  const db = getDb();
  const restored = Math.max(getShopBalance(sessionId, npcId), seed.spiritStones);

  db.transaction(() => {
    db.prepare(
      `INSERT INTO npc_shops (session_id, npc_id, spirit_stones, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id, npc_id) DO UPDATE SET
         spirit_stones = excluded.spirit_stones,
         updated_at = excluded.updated_at`
    ).run(sessionId, npcId, restored, now);

    db.prepare(
      `INSERT INTO shop_balance_regeneration (session_id, npc_id, last_regenerated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(session_id, npc_id) DO UPDATE SET
         last_regenerated_at = excluded.last_regenerated_at`
    ).run(sessionId, npcId, now);
  })();
}

/**
 * 为所有 NPC 商店检查并恢复余额（在玩家查询商店或交易前调用）。
 */
export function regenerateAllShopBalances(sessionId: string): void {
  for (const npcId of Object.keys(npcShopSeeds)) {
    if (shouldRegenerateBalance(sessionId, npcId)) {
      regenerateShopBalance(sessionId, npcId);
    }
  }
}
