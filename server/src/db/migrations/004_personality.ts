import type { Database } from "better-sqlite3";

export function runPersonalityMigration(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS npc_personality (
      session_id TEXT NOT NULL,
      base_npc_id TEXT NOT NULL,
      evolved_traits_json TEXT NOT NULL DEFAULT '[]',
      counters_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, base_npc_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_npc_personality_session ON npc_personality(session_id);
  `);
}
