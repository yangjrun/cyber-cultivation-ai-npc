import type { Database } from "better-sqlite3";

export function runGatheringMigration(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gathering_cooldowns (
      session_id TEXT NOT NULL,
      point_id TEXT NOT NULL,
      next_available_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, point_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_gathering_cooldowns_session_id ON gathering_cooldowns(session_id);
  `);
}
