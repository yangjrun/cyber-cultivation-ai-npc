import type { StateCreator } from "zustand";
import { listQuests } from "../../api/questApi";
import { switchScene as requestSwitchScene } from "../../api/sceneApi";
import type { GameActions, GameStore } from "../types";
import { getNpcName } from "../utils";

type SceneActions = Pick<GameActions, "switchScene" | "selectNpc" | "refreshQuests">;

export const createSceneSlice: StateCreator<GameStore, [], [], SceneActions> = (set, get) => ({
  switchScene: async (sceneId: string) => {
    const sessionId = get().sessionId;

    if (!sessionId || get().activeSceneId === sceneId) {
      return;
    }

    const scene = get().scenes.find((s) => s.sceneId === sceneId);

    if (!scene) {
      return;
    }

    try {
      await requestSwitchScene(sessionId, sceneId);
    } catch {
      get().appendLog("场景切换失败。");
      return;
    }

    const fallbackNpcId = scene.npcIds[0] ?? get().activeNpcId;
    const nextNpcId = scene.npcIds.includes(get().activeNpcId) ? get().activeNpcId : fallbackNpcId;

    set({ activeSceneId: sceneId, activeNpcId: nextNpcId });
    get().appendLog(`场景切换至：${scene.name}`);
  },

  selectNpc: (npcId: string) => {
    if (npcId !== get().activeNpcId) {
      set({ activeNpcId: npcId, input: "" });
      get().appendLog(`目标切换至：${getNpcName(npcId)}`);
    }
  },

  refreshQuests: async () => {
    const sessionId = get().sessionId;

    if (!sessionId || get().questsLoading) {
      return;
    }

    set({ questsLoading: true });

    try {
      const quests = await listQuests(sessionId);
      set({ quests, questsLoading: false });
    } catch {
      set({ questsLoading: false });
      get().appendLog("任务列表刷新失败。");
    }
  }
});
