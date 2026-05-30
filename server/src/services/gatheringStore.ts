import { getDb } from "../db/connection.js";

/**
 * Check if a gathering point is available (cooldown expired)
 */
export function isGatheringAvailable(sessionId: string, pointId: string): boolean {
  const row = getDb()
    .prepare("SELECT next_available_at FROM gathering_cooldowns WHERE session_id = ? AND point_id = ?")
    .get(sessionId, pointId) as { next_available_at: string } | undefined;

  if (!row) {
    return true; // No cooldown record = available
  }

  const nextAvailable = new Date(row.next_available_at);
  const now = new Date();

  return now >= nextAvailable;
}

/**
 * Get the next available time for a gathering point
 */
export function getNextAvailableTime(sessionId: string, pointId: string): string | null {
  const row = getDb()
    .prepare("SELECT next_available_at FROM gathering_cooldowns WHERE session_id = ? AND point_id = ?")
    .get(sessionId, pointId) as { next_available_at: string } | undefined;

  if (!row) {
    return null;
  }

  const nextAvailable = new Date(row.next_available_at);
  const now = new Date();

  if (now >= nextAvailable) {
    return null; // Already available
  }

  return row.next_available_at;
}

/**
 * Set cooldown for a gathering point
 */
export function setGatheringCooldown(sessionId: string, pointId: string, nextAvailableAt: string): void {
  const now = new Date().toISOString();

  getDb()
    .prepare(
      `INSERT INTO gathering_cooldowns (session_id, point_id, next_available_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id, point_id) DO UPDATE SET
        next_available_at = excluded.next_available_at,
        updated_at = excluded.updated_at`
    )
    .run(sessionId, pointId, nextAvailableAt, now);
}

/**
 * Get all gathering cooldowns for a session
 */
export function getGatheringCooldowns(sessionId: string): Array<{ pointId: string; nextAvailableAt: string }> {
  const rows = getDb()
    .prepare("SELECT point_id, next_available_at FROM gathering_cooldowns WHERE session_id = ?")
    .all(sessionId) as Array<{ point_id: string; next_available_at: string }>;

  return rows.map((row) => ({
    pointId: row.point_id,
    nextAvailableAt: row.next_available_at
  }));
}

/**
 * Clear all gathering cooldowns for tests
 */
export function clearGatheringCooldownsForTests(): void {
  getDb().prepare("DELETE FROM gathering_cooldowns").run();
}
