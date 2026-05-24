import { getAllNpcStatesForSession } from "./gameState.js";
import { getDb } from "../db/connection.js";
import { listMilestones, type MilestoneContext, type MilestoneId } from "../data/milestones.js";
import { getAllQuestProgressForSession } from "./questStore.js";
import { getPlayer } from "./playerStore.js";

type WorldStateRow = {
  flag_key: string;
  value: number;
};

type UnlockedMilestoneRow = {
  milestone_id: string;
  unlocked_at: string;
};

type SessionRow = {
  created_at: string;
};

export type UnlockedMilestone = {
  id: MilestoneId;
  unlockedAt: string;
};

export function recordFlag(sessionId: string, key: string, delta: number = 1): number {
  const updatedAt = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO world_state (session_id, flag_key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id, flag_key) DO UPDATE SET
         value = value + excluded.value,
         updated_at = excluded.updated_at`
    )
    .run(sessionId, key, delta, updatedAt);

  const row = getDb()
    .prepare("SELECT value FROM world_state WHERE session_id = ? AND flag_key = ?")
    .get(sessionId, key) as { value: number } | undefined;

  return row?.value ?? 0;
}

export function setFlag(sessionId: string, key: string, value: number): void {
  const updatedAt = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO world_state (session_id, flag_key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id, flag_key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`
    )
    .run(sessionId, key, value, updatedAt);
}

export function getWorldState(sessionId: string): Record<string, number> {
  const rows = getDb()
    .prepare("SELECT flag_key, value FROM world_state WHERE session_id = ?")
    .all(sessionId) as WorldStateRow[];

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.flag_key] = row.value;
  }
  return result;
}

export function getUnlockedMilestones(sessionId: string): UnlockedMilestone[] {
  const rows = getDb()
    .prepare(
      "SELECT milestone_id, unlocked_at FROM unlocked_milestones WHERE session_id = ? ORDER BY unlocked_at ASC"
    )
    .all(sessionId) as UnlockedMilestoneRow[];

  return rows.map((row) => ({ id: row.milestone_id as MilestoneId, unlockedAt: row.unlocked_at }));
}

export function isMilestoneUnlocked(sessionId: string, id: MilestoneId): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM unlocked_milestones WHERE session_id = ? AND milestone_id = ?")
    .get(sessionId, id) as { 1: number } | undefined;
  return Boolean(row);
}

export type EvaluateResult = {
  newlyUnlocked: MilestoneId[];
  allUnlocked: UnlockedMilestone[];
};

export function evaluateMilestones(sessionId: string): EvaluateResult {
  const context = buildMilestoneContext(sessionId);
  if (!context) {
    return { newlyUnlocked: [], allUnlocked: getUnlockedMilestones(sessionId) };
  }

  const already = new Set(getUnlockedMilestones(sessionId).map((m) => m.id));
  const newlyUnlocked: MilestoneId[] = [];
  const unlockedAt = new Date().toISOString();

  for (const def of listMilestones()) {
    if (already.has(def.id)) continue;
    if (def.unlockedBy(context)) {
      getDb()
        .prepare("INSERT INTO unlocked_milestones (session_id, milestone_id, unlocked_at) VALUES (?, ?, ?)")
        .run(sessionId, def.id, unlockedAt);
      newlyUnlocked.push(def.id);
    }
  }

  return { newlyUnlocked, allUnlocked: getUnlockedMilestones(sessionId) };
}

function buildMilestoneContext(sessionId: string): MilestoneContext | null {
  const player = getPlayer(sessionId);
  if (!player) return null;

  const sessionRow = getDb()
    .prepare("SELECT created_at FROM sessions WHERE id = ?")
    .get(sessionId) as SessionRow | undefined;
  const createdAt = sessionRow ? new Date(sessionRow.created_at).getTime() : Date.now();

  const npcStatesByScopedId = getAllNpcStatesForSession(sessionId);
  const npcStates: Record<string, import("../types/npc.js").NpcState> = {};
  for (const [npcId, state] of Object.entries(npcStatesByScopedId)) {
    npcStates[npcId] = state;
  }

  return {
    flags: getWorldState(sessionId),
    player,
    npcStates,
    quests: getAllQuestProgressForSession(sessionId),
    sessionAgeMs: Date.now() - createdAt
  };
}

export function clearWorldStateForTests(): void {
  getDb().prepare("DELETE FROM world_state").run();
  getDb().prepare("DELETE FROM unlocked_milestones").run();
  getDb().prepare("DELETE FROM run_chronicles").run();
}
