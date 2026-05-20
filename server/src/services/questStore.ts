import { getDb } from "../db/connection.js";
import type { QuestProgress, QuestStatus } from "../types/quest.js";

type QuestProgressRow = {
  session_id: string;
  quest_id: string;
  status: QuestStatus;
  progress_json: string;
  accepted_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

export function getQuestProgress(sessionId: string, questId: string): QuestProgress | null {
  const row = getDb()
    .prepare(
      `SELECT session_id, quest_id, status, progress_json, accepted_at, completed_at, updated_at
       FROM quest_progress
       WHERE session_id = ? AND quest_id = ?`
    )
    .get(sessionId, questId) as QuestProgressRow | undefined;

  return row ? mapRow(row) : null;
}

export function getAllQuestProgressForSession(sessionId: string): QuestProgress[] {
  const rows = getDb()
    .prepare(
      `SELECT session_id, quest_id, status, progress_json, accepted_at, completed_at, updated_at
       FROM quest_progress
       WHERE session_id = ?
       ORDER BY updated_at DESC`
    )
    .all(sessionId) as QuestProgressRow[];

  return rows.map(mapRow);
}

export function upsertQuestProgress(progress: Omit<QuestProgress, "updatedAt">): QuestProgress {
  const updatedAt = new Date().toISOString();

  getDb()
    .prepare(
      `INSERT INTO quest_progress (session_id, quest_id, status, progress_json, accepted_at, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, quest_id) DO UPDATE SET
        status = excluded.status,
        progress_json = excluded.progress_json,
        accepted_at = COALESCE(quest_progress.accepted_at, excluded.accepted_at),
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at`
    )
    .run(
      progress.sessionId,
      progress.questId,
      progress.status,
      JSON.stringify(progress.progress),
      progress.acceptedAt,
      progress.completedAt,
      updatedAt
    );

  const refreshed = getQuestProgress(progress.sessionId, progress.questId);

  if (!refreshed) {
    throw new Error(`Failed to persist quest progress: ${progress.questId}`);
  }

  return refreshed;
}

export function clearQuestProgressForTests(): void {
  getDb().prepare("DELETE FROM quest_progress").run();
}

function mapRow(row: QuestProgressRow): QuestProgress {
  return {
    sessionId: row.session_id,
    questId: row.quest_id,
    status: row.status,
    progress: parseProgressJson(row.progress_json),
    acceptedAt: row.accepted_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at
  };
}

function parseProgressJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
