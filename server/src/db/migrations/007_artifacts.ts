import type { Database } from "better-sqlite3";

export function runArtifactsMigration(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipped_artifacts (
      session_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      equipped_at TEXT NOT NULL,
      PRIMARY KEY (session_id, item_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_equipped_artifacts_session ON equipped_artifacts(session_id);
  `);
}
