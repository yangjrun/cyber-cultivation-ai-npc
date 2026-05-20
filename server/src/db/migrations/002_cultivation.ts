import type { Database } from "better-sqlite3";

const playerColumns = [
  { name: "roots", sql: "ALTER TABLE players ADD COLUMN roots TEXT NOT NULL DEFAULT '{\"metal\":70,\"wood\":40,\"water\":12,\"fire\":8,\"earth\":16}'" },
  { name: "active_technique_id", sql: "ALTER TABLE players ADD COLUMN active_technique_id TEXT NOT NULL DEFAULT 'basic_breathing'" },
  { name: "breakthrough_bonus_until", sql: "ALTER TABLE players ADD COLUMN breakthrough_bonus_until TEXT" },
  { name: "alert_shield_until", sql: "ALTER TABLE players ADD COLUMN alert_shield_until TEXT" },
  { name: "alert_shield_strength", sql: "ALTER TABLE players ADD COLUMN alert_shield_strength INTEGER NOT NULL DEFAULT 0" }
] as const;

export function runCultivationMigration(db: Database): void {
  for (const column of playerColumns) {
    if (!hasColumn(db, "players", column.name)) {
      db.exec(column.sql);
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS player_items (
      session_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, item_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alchemy_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      fire_level INTEGER NOT NULL,
      quality TEXT NOT NULL,
      success INTEGER NOT NULL,
      result_item_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_player_items_session_id ON player_items(session_id);
    CREATE INDEX IF NOT EXISTS idx_alchemy_attempts_session_id ON alchemy_attempts(session_id);

    INSERT OR IGNORE INTO player_items (session_id, item_id, quantity, updated_at)
      SELECT id, 'shadow_herb', 3, datetime('now') FROM sessions;
    INSERT OR IGNORE INTO player_items (session_id, item_id, quantity, updated_at)
      SELECT id, 'ash_salt', 2, datetime('now') FROM sessions;
    INSERT OR IGNORE INTO player_items (session_id, item_id, quantity, updated_at)
      SELECT id, 'cheap_qi_pill', 1, datetime('now') FROM sessions;
    INSERT OR IGNORE INTO player_items (session_id, item_id, quantity, updated_at)
      SELECT id, 'cloud_veil_pill', 1, datetime('now') FROM sessions;
  `);
}

type TableInfoRow = {
  name: string;
};

function hasColumn(db: Database, tableName: string, columnName: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as TableInfoRow[];
  return rows.some((row) => row.name === columnName);
}
