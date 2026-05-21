import { getSceneDefinition } from "../data/scenes.js";
import { getDb } from "../db/connection.js";
import { addMemory } from "./memoryStore.js";
import { applyRelationDelta } from "./npcRelationsStore.js";
import { scopedNpcId } from "./scopedNpcId.js";

const EVENT_INTERVAL_MS = 30 * 60 * 1000;
const LOCK_MS = 60 * 1000;
const DAILY_CAP = 3;

type BackgroundEventRow = {
  session_id: string;
  scene_id: string;
  player_absent_since: string | null;
  last_generated_at: string | null;
  daily_count_date: string;
  daily_count: number;
  lock_until: string | null;
};

export type BackgroundNpcEvent = {
  sessionId: string;
  sceneId: string;
  fromNpc: string;
  toNpc: string;
  summary: string;
  generatedAt: string;
};

export type BackgroundEventResult =
  | { generated: false; reason: "present" | "not_due" | "daily_cap" | "locked" | "no_pair" }
  | { generated: true; event: BackgroundNpcEvent };

export function markPlayerLeftScene({ sessionId, sceneId, now = new Date() }: ScenePresenceInput): void {
  const timestamp = now.toISOString();
  const existing = getBackgroundRow(sessionId, sceneId);

  getDb()
    .prepare(
      `INSERT INTO background_scene_events (
        session_id, scene_id, player_absent_since, last_generated_at, daily_count_date, daily_count, lock_until
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, scene_id) DO UPDATE SET
        player_absent_since = COALESCE(background_scene_events.player_absent_since, excluded.player_absent_since)`
    )
    .run(
      sessionId,
      sceneId,
      existing?.player_absent_since ?? timestamp,
      existing?.last_generated_at ?? null,
      existing?.daily_count_date ?? "",
      existing?.daily_count ?? 0,
      existing?.lock_until ?? null
    );
}

export function markPlayerEnteredScene({ sessionId, sceneId }: ScenePresenceInput): void {
  getDb()
    .prepare(
      `INSERT INTO background_scene_events (session_id, scene_id, player_absent_since, daily_count_date, daily_count)
       VALUES (?, ?, NULL, '', 0)
       ON CONFLICT(session_id, scene_id) DO UPDATE SET
        player_absent_since = NULL,
        lock_until = NULL`
    )
    .run(sessionId, sceneId);
}

export async function generateDueBackgroundEvents({
  sessionId,
  sceneId,
  now = new Date()
}: ScenePresenceInput): Promise<BackgroundEventResult> {
  const row = getBackgroundRow(sessionId, sceneId);

  if (!row?.player_absent_since) {
    return { generated: false, reason: "present" };
  }

  const nowMs = now.getTime();
  const absentSinceMs = Date.parse(row.player_absent_since);

  if (!Number.isFinite(absentSinceMs) || nowMs - absentSinceMs < EVENT_INTERVAL_MS) {
    return { generated: false, reason: "not_due" };
  }

  if (row.lock_until && Date.parse(row.lock_until) > nowMs) {
    return { generated: false, reason: "locked" };
  }

  const dateKey = now.toISOString().slice(0, 10);
  const dailyCount = row.daily_count_date === dateKey ? row.daily_count : 0;

  if (dailyCount >= DAILY_CAP) {
    return { generated: false, reason: "daily_cap" };
  }

  const pair = selectNpcPair(sceneId);

  if (!pair) {
    return { generated: false, reason: "no_pair" };
  }

  setLock(sessionId, sceneId, new Date(nowMs + LOCK_MS).toISOString());

  const [fromNpc, toNpc] = pair;
  const scene = getSceneDefinition(sceneId);
  const generatedAt = now.toISOString();
  const summary = `${scene?.name ?? sceneId}里，${fromNpc}与${toNpc}趁玩家离开交换了消息。`;

  applyRelationDelta(sessionId, fromNpc, toNpc, { trust: 1, hostility: -1 });
  applyRelationDelta(sessionId, toNpc, fromNpc, { trust: 1, hostility: -1 });
  await Promise.all([
    addMemory(scopedNpcId(sessionId, fromNpc), summary),
    addMemory(scopedNpcId(sessionId, toNpc), summary)
  ]);
  saveGenerated(sessionId, sceneId, generatedAt, dateKey, dailyCount + 1);

  return {
    generated: true,
    event: {
      sessionId,
      sceneId,
      fromNpc,
      toNpc,
      summary,
      generatedAt
    }
  };
}

export function clearBackgroundEventsForTests(): void {
  getDb().prepare("DELETE FROM background_scene_events").run();
}

type ScenePresenceInput = {
  sessionId: string;
  sceneId: string;
  now?: Date;
};

function getBackgroundRow(sessionId: string, sceneId: string): BackgroundEventRow | null {
  const row = getDb()
    .prepare(
      `SELECT session_id, scene_id, player_absent_since, last_generated_at, daily_count_date, daily_count, lock_until
       FROM background_scene_events
       WHERE session_id = ? AND scene_id = ?`
    )
    .get(sessionId, sceneId) as BackgroundEventRow | undefined;

  return row ?? null;
}

function setLock(sessionId: string, sceneId: string, lockUntil: string): void {
  getDb()
    .prepare(
      `UPDATE background_scene_events
       SET lock_until = ?
       WHERE session_id = ? AND scene_id = ?`
    )
    .run(lockUntil, sessionId, sceneId);
}

function saveGenerated(sessionId: string, sceneId: string, generatedAt: string, dateKey: string, dailyCount: number): void {
  getDb()
    .prepare(
      `UPDATE background_scene_events
       SET last_generated_at = ?, player_absent_since = ?, daily_count_date = ?, daily_count = ?, lock_until = NULL
       WHERE session_id = ? AND scene_id = ?`
    )
    .run(generatedAt, generatedAt, dateKey, dailyCount, sessionId, sceneId);
}

function selectNpcPair(sceneId: string): [string, string] | null {
  const scene = getSceneDefinition(sceneId);

  if (!scene || scene.npcIds.length < 2) {
    return null;
  }

  return [scene.npcIds[0], scene.npcIds[1]];
}
