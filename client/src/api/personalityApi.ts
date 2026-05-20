import { fetchJsonWithRetry } from "./apiClient";

export type PersonalityRecord = {
  sessionId: string;
  npcId: string;
  evolvedTraits: string[];
  counters: Record<string, number>;
  updatedAt: string;
};

export async function getPersonality(sessionId: string, npcId: string): Promise<PersonalityRecord> {
  const raw = await fetchJsonWithRetry(
    `/api/personality/${encodeURIComponent(sessionId)}/${encodeURIComponent(npcId)}`
  );

  return normalize(raw, sessionId, npcId);
}

export async function resetPersonality(sessionId: string, npcId: string): Promise<PersonalityRecord> {
  const raw = await fetchJsonWithRetry(
    `/api/personality/${encodeURIComponent(sessionId)}/${encodeURIComponent(npcId)}`,
    { method: "DELETE" }
  );

  return normalize(raw, sessionId, npcId);
}

function normalize(raw: unknown, sessionId: string, npcId: string): PersonalityRecord {
  if (!isRecord(raw)) {
    return { sessionId, npcId, evolvedTraits: [], counters: {}, updatedAt: "" };
  }

  return {
    sessionId: typeof raw.sessionId === "string" ? raw.sessionId : sessionId,
    npcId: typeof raw.npcId === "string" ? raw.npcId : npcId,
    evolvedTraits: Array.isArray(raw.evolvedTraits)
      ? raw.evolvedTraits.filter((trait): trait is string => typeof trait === "string")
      : [],
    counters: isRecord(raw.counters)
      ? Object.fromEntries(
          Object.entries(raw.counters).filter(([, value]) => typeof value === "number")
        ) as Record<string, number>
      : {},
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : ""
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
