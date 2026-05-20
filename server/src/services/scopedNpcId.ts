export const SCOPED_NPC_SEPARATOR = "::";

export function scopedNpcId(sessionId: string, baseNpcId: string): string {
  return `${sessionId}${SCOPED_NPC_SEPARATOR}${baseNpcId}`;
}

export function parseScopedNpcId(scoped: string): { sessionId: string | null; baseNpcId: string } {
  const idx = scoped.indexOf(SCOPED_NPC_SEPARATOR);

  if (idx < 0) {
    return { sessionId: null, baseNpcId: scoped };
  }

  return {
    sessionId: scoped.slice(0, idx),
    baseNpcId: scoped.slice(idx + SCOPED_NPC_SEPARATOR.length)
  };
}
