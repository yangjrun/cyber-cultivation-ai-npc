import type { StateCreator } from "zustand";
import { fetchGatheringPoints, gather } from "../../api/gatheringApi";
import type { GameActions, GameStore } from "../types";
import { ensureSession } from "../utils";

type GatheringActions = Pick<
  GameActions,
  "openGatheringModal" | "closeGatheringModal" | "refreshGatheringPoints" | "gatherFromPoint"
>;

export const createGatheringSlice: StateCreator<GameStore, [], [], GatheringActions> = (set, get) => ({
  openGatheringModal: async () => {
    set({ gatheringModalOpen: true, gatheringPoints: [] });
    await get().refreshGatheringPoints();
  },

  closeGatheringModal: () => {
    set({ gatheringModalOpen: false });
  },

  refreshGatheringPoints: async () => {
    const sessionId = await ensureSession(get);
    const sceneId = get().activeSceneId;

    if (!sessionId || !sceneId) {
      return;
    }

    set({ gatheringLoading: true, error: "" });

    try {
      const points = await fetchGatheringPoints(sessionId, sceneId);
      set({ gatheringPoints: points });
    } catch {
      set({ error: "无法加载采集点信息。" });
      get().appendLog("采集失败：无法加载采集点。");
    } finally {
      set({ gatheringLoading: false });
    }
  },

  gatherFromPoint: async (pointId: string) => {
    const sessionId = await ensureSession(get);

    if (!sessionId) {
      return;
    }

    set({ gatheringLoading: true, error: "" });

    try {
      const response = await gather(sessionId, pointId);

      set((state) => ({
        player: response.player,
        inventory: response.inventory,
        lastGatheringResult: response.message,
        gatheringResultTick: state.gatheringResultTick + 1
      }));
      get().appendLog(`采集：${response.message}`);

      // Refresh points to update cooldown status
      await get().refreshGatheringPoints();
    } catch {
      set({ error: "采集失败：后端拒绝结算。" });
      get().appendLog("采集失败：未能完成采集。");
    } finally {
      set({ gatheringLoading: false });
    }
  }
});
