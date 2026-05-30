import type { Database } from "better-sqlite3";

export function runShopRegenerationMigration(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_balance_regeneration (
      session_id TEXT NOT NULL,
      npc_id TEXT NOT NULL,
      last_regenerated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, npc_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_shop_regen_session ON shop_balance_regeneration(session_id);
  `);
}
