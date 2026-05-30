import type { Database } from "better-sqlite3";

export function runItemQualityMigration(db: Database): void {
  // SQLite doesn't support modifying primary keys directly
  // We need to recreate the table with the new composite primary key

  if (!hasColumn(db, "player_items", "quality")) {
    db.exec(`
      -- Create new table with quality in primary key
      CREATE TABLE player_items_new (
        session_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        quality TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (session_id, item_id, quality),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      -- Copy existing data (quality will be NULL for all existing items)
      INSERT INTO player_items_new (session_id, item_id, quantity, quality, updated_at)
      SELECT session_id, item_id, quantity, NULL, updated_at FROM player_items;

      -- Drop old table
      DROP TABLE player_items;

      -- Rename new table
      ALTER TABLE player_items_new RENAME TO player_items;

      -- Recreate index
      CREATE INDEX IF NOT EXISTS idx_player_items_session_id ON player_items(session_id);
    `);
  }
}

function hasColumn(db: Database, tableName: string, columnName: string): boolean {
  const result = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return result.some((col) => col.name === columnName);
}
