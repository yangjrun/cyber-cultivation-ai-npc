import type { Database } from "better-sqlite3";
import { npcShopSeeds } from "../../data/npcShops.js";

export function runTradeMigration(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS npc_shops (
      session_id TEXT NOT NULL,
      npc_id TEXT NOT NULL,
      spirit_stones INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, npc_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS npc_shop_items (
      session_id TEXT NOT NULL,
      npc_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, npc_id, item_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_npc_shop_items_session ON npc_shop_items(session_id, npc_id);
  `);

  // 给存量 session 补种商店余额与库存（仿 002_cultivation 的 INSERT OR IGNORE ... SELECT）。
  const insertShop = db.prepare(
    `INSERT OR IGNORE INTO npc_shops (session_id, npc_id, spirit_stones, updated_at)
       SELECT id, ?, ?, datetime('now') FROM sessions`
  );
  const insertStock = db.prepare(
    `INSERT OR IGNORE INTO npc_shop_items (session_id, npc_id, item_id, quantity, updated_at)
       SELECT id, ?, ?, ?, datetime('now') FROM sessions`
  );

  for (const [npcId, seed] of Object.entries(npcShopSeeds)) {
    insertShop.run(npcId, seed.spiritStones);
    for (const stock of seed.stock) {
      insertStock.run(npcId, stock.itemId, stock.quantity);
    }
  }
}
