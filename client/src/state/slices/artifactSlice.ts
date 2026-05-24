import type { StateCreator } from "zustand";
import {
  equipArtifact as requestEquip,
  fetchArtifacts,
  unequipArtifact as requestUnequip
} from "../../api/artifactApi";
import type { GameActions, GameStore } from "../types";

type ArtifactActions = Pick<
  GameActions,
  "refreshArtifacts" | "equipArtifact" | "unequipArtifact"
>;

export const createArtifactSlice: StateCreator<GameStore, [], [], ArtifactActions> = (set, get) => ({
  refreshArtifacts: async () => {
    const sessionId = get().sessionId;
    if (!sessionId || get().artifactsLoading) return;

    set({ artifactsLoading: true });
    try {
      const res = await fetchArtifacts(sessionId);
      set({ artifacts: res.owned, artifactsLoading: false });
    } catch {
      set({ artifactsLoading: false });
    }
  },

  equipArtifact: async (artifactId: string) => {
    const sessionId = get().sessionId;
    if (!sessionId) return;
    try {
      await requestEquip(sessionId, artifactId);
      get().appendLog(`已佩戴：${artifactId}`);
      void get().refreshArtifacts();
    } catch {
      set({ error: "佩戴失败。" });
    }
  },

  unequipArtifact: async (artifactId: string) => {
    const sessionId = get().sessionId;
    if (!sessionId) return;
    try {
      await requestUnequip(sessionId, artifactId);
      get().appendLog(`已收起：${artifactId}`);
      void get().refreshArtifacts();
    } catch {
      set({ error: "收起失败。" });
    }
  }
});
