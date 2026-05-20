import { randomUUID } from "node:crypto";
import { getDb } from "../db/connection.js";
import type { PlayerState, SessionSnapshot } from "../types/player.js";

const defaultPlayer = {
  name: "陆玄",
  realm: "练气期",
  hasIllegalChip: true,
  visibleTraits: ["右臂义体", "雷罚残痕", "非法灵根波形"],
  recentActions: ["救过白璃的药童"],
  spiritStones: 0,
  qiCurrent: 0,
  qiCap: 100,
  cultivationStageIdx: 0
} as const;

type PlayerRow = {
  id: string;
  session_id: string;
  name: string;
  realm: string;
  has_illegal_chip: number;
  visible_traits: string;
  recent_actions: string;
  spirit_stones: number;
  qi_current: number;
  qi_cap: number;
  cultivation_stage_idx: number;
};

export function createSession(): SessionSnapshot {
  const sessionId = randomUUID();
  const playerId = randomUUID();
  const createdAt = nowIso();
  const db = getDb();

  db.transaction(() => {
    db.prepare("INSERT INTO sessions (id, created_at, updated_at) VALUES (?, ?, ?)")
      .run(sessionId, createdAt, createdAt);
    insertPlayer(sessionId, playerId, createdAt);
  })();

  const session = getSession(sessionId);

  if (!session) {
    throw new Error("Failed to create session");
  }

  return session;
}

export function getSession(sessionId: string): SessionSnapshot | null {
  const player = getPlayer(sessionId);

  if (!player) {
    return null;
  }

  return {
    sessionId,
    playerId: player.id,
    player
  };
}

export function sessionExists(sessionId: string): boolean {
  const row = getDb().prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId) as { id: string } | undefined;
  return Boolean(row);
}

export function createPlayer(sessionId: string): PlayerState {
  const existing = getPlayer(sessionId);

  if (existing) {
    return existing;
  }

  const createdAt = nowIso();
  const playerId = randomUUID();
  insertPlayer(sessionId, playerId, createdAt);

  const player = getPlayer(sessionId);

  if (!player) {
    throw new Error("Failed to create player");
  }

  return player;
}

export function getPlayer(sessionId: string): PlayerState | null {
  const row = getDb()
    .prepare(
      `SELECT id, session_id, name, realm, has_illegal_chip, visible_traits, recent_actions,
        spirit_stones, qi_current, qi_cap, cultivation_stage_idx
       FROM players
       WHERE session_id = ?`
    )
    .get(sessionId) as PlayerRow | undefined;

  return row ? mapPlayer(row) : null;
}

export function updatePlayer(sessionId: string, patch: Partial<Pick<PlayerState, "spiritStones" | "qiCurrent" | "qiCap" | "cultivationStageIdx">>): PlayerState {
  const current = getPlayer(sessionId);

  if (!current) {
    throw new Error("Player not found");
  }

  const next: PlayerState = {
    ...current,
    spiritStones: clampInteger(patch.spiritStones ?? current.spiritStones, 0, Number.MAX_SAFE_INTEGER),
    qiCurrent: clampInteger(patch.qiCurrent ?? current.qiCurrent, 0, Number.MAX_SAFE_INTEGER),
    qiCap: clampInteger(patch.qiCap ?? current.qiCap, 1, Number.MAX_SAFE_INTEGER),
    cultivationStageIdx: clampInteger(patch.cultivationStageIdx ?? current.cultivationStageIdx, 0, Number.MAX_SAFE_INTEGER)
  };

  const updatedAt = nowIso();
  getDb()
    .prepare(
      `UPDATE players
       SET spirit_stones = ?, qi_current = ?, qi_cap = ?, cultivation_stage_idx = ?, updated_at = ?
       WHERE session_id = ?`
    )
    .run(next.spiritStones, next.qiCurrent, next.qiCap, next.cultivationStageIdx, updatedAt, sessionId);

  return next;
}

export function clearSessionsForTests(): void {
  getDb().prepare("DELETE FROM sessions").run();
}

function insertPlayer(sessionId: string, playerId: string, createdAt: string): void {
  getDb()
    .prepare(
      `INSERT INTO players (
        id, session_id, name, realm, has_illegal_chip, visible_traits, recent_actions,
        spirit_stones, qi_current, qi_cap, cultivation_stage_idx, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      playerId,
      sessionId,
      defaultPlayer.name,
      defaultPlayer.realm,
      defaultPlayer.hasIllegalChip ? 1 : 0,
      JSON.stringify(defaultPlayer.visibleTraits),
      JSON.stringify(defaultPlayer.recentActions),
      defaultPlayer.spiritStones,
      defaultPlayer.qiCurrent,
      defaultPlayer.qiCap,
      defaultPlayer.cultivationStageIdx,
      createdAt,
      createdAt
    );
}

function mapPlayer(row: PlayerRow): PlayerState {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    realm: row.realm,
    hasIllegalChip: row.has_illegal_chip === 1,
    visibleTraits: parseStringArray(row.visible_traits),
    recentActions: parseStringArray(row.recent_actions),
    spiritStones: row.spirit_stones,
    qiCurrent: row.qi_current,
    qiCap: row.qi_cap,
    cultivationStageIdx: row.cultivation_stage_idx
  };
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function nowIso(): string {
  return new Date().toISOString();
}
