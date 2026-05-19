let memoriesByNpc: Record<string, string[]> = {};

export function getRecentMemories(npcId: string, limit = 5): string[] {
  const memories = memoriesByNpc[npcId] ?? [];
  return memories.slice(Math.max(0, memories.length - limit));
}

export function addMemory(npcId: string, memory: string): void {
  const normalized = memory.trim();

  if (!normalized) {
    return;
  }

  const existing = memoriesByNpc[npcId] ?? [];
  const nextMemories = [...existing, normalized].slice(-20);

  memoriesByNpc = {
    ...memoriesByNpc,
    [npcId]: nextMemories
  };
}

export function clearMemories(npcId: string): void {
  memoriesByNpc = {
    ...memoriesByNpc,
    [npcId]: []
  };
}
