import type { Database } from "better-sqlite3";

export function runStorylineMigration(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS world_state (
      session_id TEXT NOT NULL,
      flag_key TEXT NOT NULL,
      value INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, flag_key),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_state_session ON world_state(session_id);

    CREATE TABLE IF NOT EXISTS unlocked_milestones (
      session_id TEXT NOT NULL,
      milestone_id TEXT NOT NULL,
      unlocked_at TEXT NOT NULL,
      PRIMARY KEY (session_id, milestone_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_unlocked_milestones_session ON unlocked_milestones(session_id);

    CREATE TABLE IF NOT EXISTS run_chronicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      content TEXT NOT NULL,
      milestones_snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_run_chronicles_session ON run_chronicles(session_id, id DESC);
  `);
}
