import { getDb } from "../db/connection.js";
import { sessionExists } from "./playerStore.js";

const scopedNpcSeparator = "::";

type MemoryRow = {
  content: string;
};

export function getRecentMemories(npcId: string, limit = 5): string[] {
  const safeLimit = Math.max(0, Math.trunc(limit));

  if (safeLimit === 0) {
    return [];
  }

  const rows = getDb()
    .prepare(
      `SELECT content
       FROM (
        SELECT id, content
        FROM memories
        WHERE scoped_npc_id = ?
        ORDER BY id DESC
        LIMIT ?
       )
       ORDER BY id ASC`
    )
    .all(npcId, safeLimit) as MemoryRow[];

  return rows.map((row) => row.content);
}

export function addMemory(npcId: string, memory: string): void {
  const normalized = memory.trim();

  if (!normalized) {
    return;
  }

  const db = getDb();
  const sessionId = getPersistableSessionId(npcId);

  db.transaction(() => {
    db.prepare("INSERT INTO memories (scoped_npc_id, session_id, content, created_at) VALUES (?, ?, ?, ?)")
      .run(npcId, sessionId, normalized, new Date().toISOString());
    db.prepare(
      `DELETE FROM memories
       WHERE scoped_npc_id = ?
       AND id NOT IN (
        SELECT id
        FROM memories
        WHERE scoped_npc_id = ?
        ORDER BY id DESC
        LIMIT 20
       )`
    ).run(npcId, npcId);
  })();
}

export function clearMemories(npcId: string): void {
  getDb().prepare("DELETE FROM memories WHERE scoped_npc_id = ?").run(npcId);
}

export function clearAllMemoriesForTests(): void {
  getDb().prepare("DELETE FROM memories").run();
}

function getPersistableSessionId(npcId: string): string | null {
  const [sessionId] = npcId.split(scopedNpcSeparator);
  return npcId.includes(scopedNpcSeparator) && sessionExists(sessionId) ? sessionId : null;
}
