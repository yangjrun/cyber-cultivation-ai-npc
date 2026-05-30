import { fetchJsonWithRetry } from "./apiClient";

export type QuestStatus = "available" | "accepted" | "in_progress" | "completed" | "failed";

export type QuestDefinition = {
  questId: string;
  title: string;
  description: string;
  giverNpcId: string;
  involvedNpcIds: string[];
};

export type QuestProgress = {
  sessionId: string;
  questId: string;
  status: QuestStatus;
  progress: Record<string, unknown>;
  acceptedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  definition: QuestDefinition | null;
  repeatable: boolean;
  nextAvailableAt: string | null;
};

export async function listQuests(sessionId: string): Promise<QuestProgress[]> {
  const raw = await fetchJsonWithRetry(`/api/quests/${encodeURIComponent(sessionId)}`);
  return normalizeQuestList(raw);
}

export async function listQuestDefinitions(): Promise<QuestDefinition[]> {
  const raw = await fetchJsonWithRetry("/api/quests/definitions");

  if (!isRecord(raw) || !Array.isArray(raw.definitions)) {
    return [];
  }

  return raw.definitions.flatMap((entry): QuestDefinition[] => {
    const def = normalizeDefinition(entry);
    return def ? [def] : [];
  });
}

export function normalizeQuestList(raw: unknown): QuestProgress[] {
  if (!isRecord(raw) || !Array.isArray(raw.quests)) {
    return [];
  }

  return raw.quests.flatMap((entry): QuestProgress[] => {
    if (!isRecord(entry)) {
      return [];
    }

    const questId = typeof entry.questId === "string" ? entry.questId : "";
    const sessionId = typeof entry.sessionId === "string" ? entry.sessionId : "";

    if (!questId || !sessionId) {
      return [];
    }

    return [{
      sessionId,
      questId,
      status: normalizeStatus(entry.status),
      progress: isRecord(entry.progress) ? entry.progress : {},
      acceptedAt: typeof entry.acceptedAt === "string" ? entry.acceptedAt : null,
      completedAt: typeof entry.completedAt === "string" ? entry.completedAt : null,
      updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : "",
      definition: normalizeDefinition(entry.definition),
      repeatable: entry.repeatable === true,
      nextAvailableAt: typeof entry.nextAvailableAt === "string" ? entry.nextAvailableAt : null
    }];
  });
}

function normalizeStatus(value: unknown): QuestStatus {
  if (value === "accepted" || value === "in_progress" || value === "completed" || value === "failed") {
    return value;
  }

  return "available";
}

function normalizeDefinition(raw: unknown): QuestDefinition | null {
  if (!isRecord(raw) || typeof raw.questId !== "string") {
    return null;
  }

  return {
    questId: raw.questId,
    title: typeof raw.title === "string" ? raw.title : raw.questId,
    description: typeof raw.description === "string" ? raw.description : "",
    giverNpcId: typeof raw.giverNpcId === "string" ? raw.giverNpcId : "",
    involvedNpcIds: Array.isArray(raw.involvedNpcIds)
      ? raw.involvedNpcIds.filter((id): id is string => typeof id === "string")
      : []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
