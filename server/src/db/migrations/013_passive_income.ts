import type { Database } from "better-sqlite3";

export function runPassiveIncomeMigration(db: Database): void {
  // Track the last time passive income was settled for the player.
  // NULL means never claimed; the first claim sets the anchor without paying out.
  if (!hasColumn(db, "players", "passive_income_claimed_at")) {
    db.exec(`
      ALTER TABLE players ADD COLUMN passive_income_claimed_at TEXT;
    `);
  }
}

function hasColumn(db: Database, tableName: string, columnName: string): boolean {
  const result = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return result.some((col) => col.name === columnName);
}
