import { initialNpcRelations } from "../data/npcInitialRelations.js";
import { getDb } from "../db/connection.js";
import type { NpcRelation, NpcRelationDelta } from "../types/relations.js";

type NpcRelationRow = {
  session_id: string;
  from_npc: string;
  to_npc: string;
  trust: number;
  hostility: number;
  updated_at: string;
};

export function initializeRelationsForSession(sessionId: string): void {
  const db = getDb();
  const updatedAt = new Date().toISOString();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO npc_relations (session_id, from_npc, to_npc, trust, hostility, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  db.transaction(() => {
    for (const seed of initialNpcRelations) {
      insert.run(sessionId, seed.fromNpc, seed.toNpc, seed.trust, seed.hostility, updatedAt);
    }
  })();
}

export function getRelation(sessionId: string, fromNpc: string, toNpc: string): NpcRelation | null {
  const row = getDb()
    .prepare(
      `SELECT session_id, from_npc, to_npc, trust, hostility, updated_at
       FROM npc_relations
       WHERE session_id = ? AND from_npc = ? AND to_npc = ?`
    )
    .get(sessionId, fromNpc, toNpc) as NpcRelationRow | undefined;

  return row ? mapRow(row) : null;
}

export function getAllRelationsForSession(sessionId: string): NpcRelation[] {
  const rows = getDb()
    .prepare(
      `SELECT session_id, from_npc, to_npc, trust, hostility, updated_at
       FROM npc_relations
       WHERE session_id = ?
       ORDER BY from_npc ASC, to_npc ASC`
    )
    .all(sessionId) as NpcRelationRow[];

  return rows.map(mapRow);
}

export function applyRelationDelta(
  sessionId: string,
  fromNpc: string,
  toNpc: string,
  delta: NpcRelationDelta
): NpcRelation {
  const current = getRelation(sessionId, fromNpc, toNpc);
  const next = {
    trust: clamp((current?.trust ?? 0) + (delta.trust ?? 0), -100, 100),
    hostility: clamp((current?.hostility ?? 0) + (delta.hostility ?? 0), 0, 100)
  };
  const updatedAt = new Date().toISOString();

  getDb()
    .prepare(
      `INSERT INTO npc_relations (session_id, from_npc, to_npc, trust, hostility, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, from_npc, to_npc) DO UPDATE SET
         trust = excluded.trust,
         hostility = excluded.hostility,
         updated_at = excluded.updated_at`
    )
    .run(sessionId, fromNpc, toNpc, next.trust, next.hostility, updatedAt);

  return {
    sessionId,
    fromNpc,
    toNpc,
    trust: next.trust,
    hostility: next.hostility,
    updatedAt
  };
}

export function clearRelationsForTests(): void {
  getDb().prepare("DELETE FROM npc_relations").run();
}

function mapRow(row: NpcRelationRow): NpcRelation {
  return {
    sessionId: row.session_id,
    fromNpc: row.from_npc,
    toNpc: row.to_npc,
    trust: row.trust,
    hostility: row.hostility,
    updatedAt: row.updated_at
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
