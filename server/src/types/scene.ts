import type { NpcProfile, NpcState } from "./npc.js";

export type SceneDefinition = {
  sceneId: string;
  name: string;
  description: string;
  backgroundAsset: string;
  npcIds: string[];
  unlockedByDefault: boolean;
};

export type ScenePeerSummary = {
  npcId: string;
  name: string;
  role: string;
  oneLineRelation: string;
};

export type SceneSnapshot = {
  scene: SceneDefinition;
  npcs: Array<{
    profile: NpcProfile;
    state: NpcState;
  }>;
};
