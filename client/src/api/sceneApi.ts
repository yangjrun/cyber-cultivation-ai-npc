import { fetchJsonWithRetry } from "./apiClient";
import type { NpcStateSnapshot } from "./sessionApi";

export type SceneDefinition = {
  sceneId: string;
  name: string;
  description: string;
  backgroundAsset: string;
  npcIds: string[];
  unlockedByDefault: boolean;
};

export type SceneNpcEntry = {
  profile: {
    npc_id: string;
    name: string;
    role: string;
    faction: string;
  };
  state: NpcStateSnapshot;
};

export type SceneSnapshot = {
  scene: SceneDefinition;
  npcs: SceneNpcEntry[];
};

export async function listScenes(): Promise<SceneDefinition[]> {
  const raw = await fetchJsonWithRetry("/api/scenes");
  return normalizeSceneList(raw);
}

export async function switchScene(sessionId: string, sceneId: string): Promise<{ sessionId: string; activeSceneId: string }> {
  const raw = await fetchJsonWithRetry("/api/scenes/switch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, sceneId })
  });

  if (isRecord(raw) && typeof raw.sessionId === "string" && typeof raw.activeSceneId === "string") {
    return { sessionId: raw.sessionId, activeSceneId: raw.activeSceneId };
  }

  return { sessionId, activeSceneId: sceneId };
}

export async function getSceneSnapshot(sceneId: string, sessionId: string): Promise<SceneSnapshot | null> {
  const url = `/api/scenes/${encodeURIComponent(sceneId)}/snapshot?sessionId=${encodeURIComponent(sessionId)}`;
  const raw = await fetchJsonWithRetry(url);

  if (!isRecord(raw)) {
    return null;
  }

  const scene = normalizeScene(raw.scene);

  if (!scene) {
    return null;
  }

  const npcs = Array.isArray(raw.npcs)
    ? raw.npcs.flatMap((entry): SceneNpcEntry[] => {
        if (!isRecord(entry) || !isRecord(entry.profile) || !isRecord(entry.state)) {
          return [];
        }

        const profile = entry.profile;
        const state = entry.state;

        return [{
          profile: {
            npc_id: String(profile.npc_id ?? ""),
            name: String(profile.name ?? ""),
            role: String(profile.role ?? ""),
            faction: String(profile.faction ?? "")
          },
          state: {
            trust: Number(state.trust ?? 0),
            fear: Number(state.fear ?? 0),
            anger: Number(state.anger ?? 0),
            tianDaoAlert: Number(state.tianDaoAlert ?? 0)
          }
        }];
      })
    : [];

  return { scene, npcs };
}

export function normalizeSceneList(raw: unknown): SceneDefinition[] {
  if (!isRecord(raw) || !Array.isArray(raw.scenes)) {
    return [];
  }

  return raw.scenes.flatMap((entry): SceneDefinition[] => {
    const scene = normalizeScene(entry);
    return scene ? [scene] : [];
  });
}

function normalizeScene(raw: unknown): SceneDefinition | null {
  if (!isRecord(raw) || typeof raw.sceneId !== "string") {
    return null;
  }

  return {
    sceneId: raw.sceneId,
    name: typeof raw.name === "string" ? raw.name : raw.sceneId,
    description: typeof raw.description === "string" ? raw.description : "",
    backgroundAsset: typeof raw.backgroundAsset === "string" ? raw.backgroundAsset : "",
    npcIds: Array.isArray(raw.npcIds) ? raw.npcIds.filter((id): id is string => typeof id === "string") : [],
    unlockedByDefault: raw.unlockedByDefault === true
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
