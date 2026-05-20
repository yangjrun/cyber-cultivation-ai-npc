import type { Database } from "better-sqlite3";

export function runWorldMigration(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS quest_progress (
      session_id TEXT NOT NULL,
      quest_id TEXT NOT NULL,
      status TEXT NOT NULL,
      progress_json TEXT NOT NULL DEFAULT '{}',
      accepted_at TEXT,
      completed_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, quest_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS npc_relations (
      session_id TEXT NOT NULL,
      from_npc TEXT NOT NULL,
      to_npc TEXT NOT NULL,
      trust INTEGER NOT NULL DEFAULT 0,
      hostility INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, from_npc, to_npc),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS active_scene (
      session_id TEXT PRIMARY KEY,
      scene_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_quest_progress_session ON quest_progress(session_id);
    CREATE INDEX IF NOT EXISTS idx_npc_relations_session ON npc_relations(session_id);
  `);
}
