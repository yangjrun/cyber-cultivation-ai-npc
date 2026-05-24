import { fetchJsonWithRetry } from "./apiClient";

export type MilestoneSnapshot = {
  id: string;
  title: string;
  description: string;
  unlockedAt: string;
};

export type RunChronicle = {
  id: number;
  sessionId: string;
  content: string;
  milestonesSnapshot: string[];
  createdAt: string;
};

export type MilestonesResponse = {
  unlocked: Array<{ id: string; unlockedAt: string }>;
  total: number;
  catalog: MilestoneSnapshot[];
};

export async function generateChronicle(sessionId: string): Promise<RunChronicle> {
  const raw = await fetchJsonWithRetry(`/api/chronicle/${encodeURIComponent(sessionId)}`, {
    method: "POST"
  });
  return normalizeChronicle(raw);
}

export async function listChronicles(sessionId: string): Promise<RunChronicle[]> {
  const raw = await fetchJsonWithRetry(`/api/chronicle/${encodeURIComponent(sessionId)}`);
  if (!isRecord(raw) || !Array.isArray(raw.chronicles)) return [];
  return raw.chronicles.flatMap((entry: unknown): RunChronicle[] => {
    const normalized = normalizeChronicle(entry);
    return normalized.id > 0 ? [normalized] : [];
  });
}

export async function fetchMilestones(sessionId: string): Promise<MilestonesResponse> {
  const raw = await fetchJsonWithRetry(`/api/chronicle/${encodeURIComponent(sessionId)}/milestones`);
  if (!isRecord(raw)) return { unlocked: [], total: 0, catalog: [] };
  return {
    unlocked: Array.isArray(raw.unlocked)
      ? raw.unlocked.flatMap((entry: unknown): Array<{ id: string; unlockedAt: string }> => {
          if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.unlockedAt !== "string") return [];
          return [{ id: entry.id, unlockedAt: entry.unlockedAt }];
        })
      : [],
    total: typeof raw.total === "number" ? raw.total : 0,
    catalog: Array.isArray(raw.catalog)
      ? raw.catalog.flatMap((entry: unknown): MilestoneSnapshot[] => {
          if (
            !isRecord(entry) ||
            typeof entry.id !== "string" ||
            typeof entry.title !== "string" ||
            typeof entry.description !== "string" ||
            typeof entry.unlockedAt !== "string"
          )
            return [];
          return [{ id: entry.id, title: entry.title, description: entry.description, unlockedAt: entry.unlockedAt }];
        })
      : []
  };
}

function normalizeChronicle(raw: unknown): RunChronicle {
  if (!isRecord(raw)) {
    return { id: 0, sessionId: "", content: "", milestonesSnapshot: [], createdAt: "" };
  }
  return {
    id: typeof raw.id === "number" ? raw.id : 0,
    sessionId: typeof raw.sessionId === "string" ? raw.sessionId : "",
    content: typeof raw.content === "string" ? raw.content : "",
    milestonesSnapshot: Array.isArray(raw.milestonesSnapshot)
      ? raw.milestonesSnapshot.filter((v): v is string => typeof v === "string")
      : [],
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : ""
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
