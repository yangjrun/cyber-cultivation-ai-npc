const MAX_LOG_PER_SESSION = 20;

const speakerEntries = new Map<string, Array<{ npcId: string; turn: number }>>();
const turnCounters = new Map<string, number>();

export function recordSpeakers(sessionId: string, npcIds: string[]): void {
  if (npcIds.length === 0) {
    return;
  }

  const nextTurn = (turnCounters.get(sessionId) ?? 0) + 1;
  turnCounters.set(sessionId, nextTurn);

  const previous = speakerEntries.get(sessionId) ?? [];
  const updated = [...previous, ...npcIds.map((npcId) => ({ npcId, turn: nextTurn }))];

  speakerEntries.set(sessionId, updated.slice(-MAX_LOG_PER_SESSION));
}

export function getLastSpokeTurns(sessionId: string): Record<string, number> {
  const currentTurn = turnCounters.get(sessionId) ?? 0;
  const entries = speakerEntries.get(sessionId) ?? [];
  const result: Record<string, number> = {};

  for (const { npcId, turn } of entries) {
    const distance = currentTurn - turn;
    const existing = result[npcId];

    if (existing === undefined || distance < existing) {
      result[npcId] = distance;
    }
  }

  return result;
}

export function resetSpeakerLog(sessionId?: string): void {
  if (sessionId) {
    speakerEntries.delete(sessionId);
    turnCounters.delete(sessionId);
    return;
  }

  speakerEntries.clear();
  turnCounters.clear();
}
