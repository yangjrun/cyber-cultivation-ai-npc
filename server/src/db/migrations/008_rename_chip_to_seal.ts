import type { Database } from "better-sqlite3";

export function runRenameChipMigration(db: Database): void {
  const columns = db
    .prepare("PRAGMA table_info(players)")
    .all() as Array<{ name: string }>;

  const hasOldColumn = columns.some((col) => col.name === "has_illegal_chip");
  const hasNewColumn = columns.some((col) => col.name === "has_illegal_seal");

  if (hasNewColumn || !hasOldColumn) {
    return;
  }

  db.exec("ALTER TABLE players RENAME COLUMN has_illegal_chip TO has_illegal_seal");
}
