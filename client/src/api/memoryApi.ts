import { fetchJsonWithRetry } from "./apiClient";

export type StoredMemory = {
  id: number;
  content: string;
  createdAt: string;
};

export async function listMemories(sessionId: string, npcId: string, limit = 20): Promise<StoredMemory[]> {
  const raw = await fetchJsonWithRetry(
    `/api/memory/${encodeURIComponent(sessionId)}/${encodeURIComponent(npcId)}?limit=${limit}`
  );

  if (!isRecord(raw) || !Array.isArray(raw.memories)) {
    return [];
  }

  return raw.memories.flatMap((entry): StoredMemory[] => {
    if (!isRecord(entry) || typeof entry.id !== "number" || typeof entry.content !== "string") {
      return [];
    }

    return [{
      id: entry.id,
      content: entry.content,
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : ""
    }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
