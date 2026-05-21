import type { Database } from "better-sqlite3";

export function runBackgroundEventsMigration(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS background_scene_events (
      session_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      player_absent_since TEXT,
      last_generated_at TEXT,
      daily_count_date TEXT NOT NULL DEFAULT '',
      daily_count INTEGER NOT NULL DEFAULT 0,
      lock_until TEXT,
      PRIMARY KEY (session_id, scene_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_background_scene_events_session ON background_scene_events(session_id);
  `);
}
