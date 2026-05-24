import { fetchJsonWithRetry } from "./apiClient";

export type ArtifactCatalogEntry = {
  id: string;
  name: string;
  description: string;
  visibleTag: string;
};

export type OwnedArtifact = ArtifactCatalogEntry & {
  equipped: boolean;
};

export type ArtifactsResponse = {
  owned: OwnedArtifact[];
  catalog: ArtifactCatalogEntry[];
};

export async function fetchArtifacts(sessionId: string): Promise<ArtifactsResponse> {
  const raw = await fetchJsonWithRetry(`/api/artifacts/${encodeURIComponent(sessionId)}`);
  if (!isRecord(raw)) return { owned: [], catalog: [] };
  return {
    owned: Array.isArray(raw.owned) ? raw.owned.flatMap(normalizeOwned) : [],
    catalog: Array.isArray(raw.catalog) ? raw.catalog.flatMap(normalizeCatalog) : []
  };
}

export async function equipArtifact(sessionId: string, artifactId: string): Promise<void> {
  await fetchJsonWithRetry(`/api/artifacts/${encodeURIComponent(sessionId)}/equip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artifactId })
  });
}

export async function unequipArtifact(sessionId: string, artifactId: string): Promise<void> {
  await fetchJsonWithRetry(`/api/artifacts/${encodeURIComponent(sessionId)}/unequip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artifactId })
  });
}

function normalizeCatalog(raw: unknown): ArtifactCatalogEntry[] {
  if (!isRecord(raw)) return [];
  if (
    typeof raw.id !== "string" ||
    typeof raw.name !== "string" ||
    typeof raw.description !== "string" ||
    typeof raw.visibleTag !== "string"
  ) {
    return [];
  }
  return [{ id: raw.id, name: raw.name, description: raw.description, visibleTag: raw.visibleTag }];
}

function normalizeOwned(raw: unknown): OwnedArtifact[] {
  if (!isRecord(raw)) return [];
  if (
    typeof raw.id !== "string" ||
    typeof raw.name !== "string" ||
    typeof raw.description !== "string" ||
    typeof raw.visibleTag !== "string" ||
    typeof raw.equipped !== "boolean"
  ) {
    return [];
  }
  return [
    {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      visibleTag: raw.visibleTag,
      equipped: raw.equipped
    }
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
