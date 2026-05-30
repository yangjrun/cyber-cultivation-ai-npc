CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  realm TEXT NOT NULL,
  has_illegal_seal INTEGER NOT NULL,
  visible_traits TEXT NOT NULL,
  recent_actions TEXT NOT NULL,
  spirit_stones INTEGER NOT NULL,
  qi_current INTEGER NOT NULL,
  qi_cap INTEGER NOT NULL,
  cultivation_stage_idx INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS npc_states (
  scoped_npc_id TEXT PRIMARY KEY,
  base_npc_id TEXT NOT NULL,
  session_id TEXT,
  trust INTEGER NOT NULL,
  fear INTEGER NOT NULL,
  anger INTEGER NOT NULL,
  tian_dao_alert INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scoped_npc_id TEXT NOT NULL,
  session_id TEXT,
  content TEXT NOT NULL,
  embedding BLOB,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memories_scoped_npc_id_id ON memories(scoped_npc_id, id);
CREATE INDEX IF NOT EXISTS idx_npc_states_session_id ON npc_states(session_id);
