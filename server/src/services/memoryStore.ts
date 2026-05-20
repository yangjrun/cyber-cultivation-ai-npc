import { getDb } from "../db/connection.js";
import { blobToVector, cosineSimilarity, getDefaultProvider, vectorToBlob } from "./embedding/index.js";
import { sessionExists } from "./playerStore.js";
import type { SimilarityScore } from "../types/embedding.js";

const scopedNpcSeparator = "::";
const MEMORY_LRU_LIMIT = 100;

type MemoryRow = {
  content: string;
};

type EmbeddingRow = {
  id: number;
  content: string;
  embedding: Buffer | null;
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

export async function retrieveRelevantMemories(npcId: string, query: string, limit = 5): Promise<SimilarityScore[]> {
  const safeLimit = Math.max(0, Math.trunc(limit));
  const trimmedQuery = query?.trim() ?? "";

  if (safeLimit === 0 || !trimmedQuery) {
    return [];
  }

  await backfillMissingEmbeddings(npcId);

  const rows = getDb()
    .prepare("SELECT id, content, embedding FROM memories WHERE scoped_npc_id = ? ORDER BY id ASC")
    .all(npcId) as EmbeddingRow[];

  if (rows.length === 0) {
    return [];
  }

  const provider = getDefaultProvider();
  const queryVector = await provider.embed(trimmedQuery);
  const scored: SimilarityScore[] = [];

  for (const row of rows) {
    if (!row.embedding) {
      continue;
    }

    const vector = blobToVector(row.embedding);
    const score = cosineSimilarity(queryVector, vector);

    scored.push({ id: row.id, content: row.content, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, safeLimit);
}

export async function addMemory(npcId: string, memory: string): Promise<void> {
  const normalized = memory.trim();

  if (!normalized) {
    return;
  }

  const provider = getDefaultProvider();
  const vector = await provider.embed(normalized);
  const blob = vectorToBlob(vector);
  const db = getDb();
  const sessionId = getPersistableSessionId(npcId);
  const createdAt = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO memories (scoped_npc_id, session_id, content, embedding, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(npcId, sessionId, normalized, blob, createdAt);

    db.prepare(
      `DELETE FROM memories
       WHERE scoped_npc_id = ?
       AND id NOT IN (
        SELECT id
        FROM memories
        WHERE scoped_npc_id = ?
        ORDER BY id DESC
        LIMIT ?
       )`
    ).run(npcId, npcId, MEMORY_LRU_LIMIT);
  })();
}

export function clearMemories(npcId: string): void {
  getDb().prepare("DELETE FROM memories WHERE scoped_npc_id = ?").run(npcId);
}

export function clearAllMemoriesForTests(): void {
  getDb().prepare("DELETE FROM memories").run();
}

async function backfillMissingEmbeddings(npcId: string): Promise<void> {
  const missing = getDb()
    .prepare("SELECT id, content FROM memories WHERE scoped_npc_id = ? AND embedding IS NULL")
    .all(npcId) as Array<{ id: number; content: string }>;

  if (missing.length === 0) {
    return;
  }

  const provider = getDefaultProvider();
  const vectors = await provider.embedBatch(missing.map((row) => row.content));
  const update = getDb().prepare("UPDATE memories SET embedding = ? WHERE id = ?");

  getDb().transaction(() => {
    missing.forEach((row, index) => {
      update.run(vectorToBlob(vectors[index]), row.id);
    });
  })();
}

function getPersistableSessionId(npcId: string): string | null {
  const [sessionId] = npcId.split(scopedNpcSeparator);
  return npcId.includes(scopedNpcSeparator) && sessionExists(sessionId) ? sessionId : null;
}
