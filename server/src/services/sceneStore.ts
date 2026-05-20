import { DEFAULT_SCENE_ID, getSceneDefinition, listScenes, sceneDefinitions } from "../data/scenes.js";
import { getDb } from "../db/connection.js";
import { getNpcProfile, getNpcState } from "./gameState.js";
import { scopedNpcId } from "./scopedNpcId.js";
import type { SceneDefinition, SceneSnapshot } from "../types/scene.js";

type ActiveSceneRow = {
  scene_id: string;
};

export function getSceneById(sceneId: string): SceneDefinition | null {
  return getSceneDefinition(sceneId);
}

export function getAllScenes(): SceneDefinition[] {
  return listScenes();
}

export function getNpcsInScene(sceneId: string): string[] {
  const scene = sceneDefinitions[sceneId];
  return scene ? [...scene.npcIds] : [];
}

export function getActiveSceneId(sessionId: string): string {
  const row = getDb()
    .prepare("SELECT scene_id FROM active_scene WHERE session_id = ?")
    .get(sessionId) as ActiveSceneRow | undefined;

  return row?.scene_id ?? DEFAULT_SCENE_ID;
}

export function setActiveSceneId(sessionId: string, sceneId: string): void {
  if (!sceneDefinitions[sceneId]) {
    throw new Error(`Unknown scene: ${sceneId}`);
  }

  getDb()
    .prepare(
      `INSERT INTO active_scene (session_id, scene_id, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         scene_id = excluded.scene_id,
         updated_at = excluded.updated_at`
    )
    .run(sessionId, sceneId, new Date().toISOString());
}

export function getSceneSnapshot(sessionId: string, sceneId: string): SceneSnapshot | null {
  const scene = getSceneDefinition(sceneId);

  if (!scene) {
    return null;
  }

  const npcs = scene.npcIds.map((npcId) => ({
    profile: getNpcProfile(npcId),
    state: getNpcState(scopedNpcId(sessionId, npcId))
  }));

  return { scene, npcs };
}
