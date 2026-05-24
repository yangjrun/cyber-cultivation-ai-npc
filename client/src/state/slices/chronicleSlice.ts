import type { StateCreator } from "zustand";
import {
  fetchMilestones,
  generateChronicle as requestGenerateChronicle,
  listChronicles
} from "../../api/chronicleApi";
import type { GameActions, GameStore } from "../types";

type ChronicleActions = Pick<
  GameActions,
  "generateChronicle" | "refreshChronicles" | "refreshMilestones"
>;

export const createChronicleSlice: StateCreator<GameStore, [], [], ChronicleActions> = (set, get) => ({
  generateChronicle: async () => {
    const sessionId = get().sessionId;
    if (!sessionId || get().chronicleLoading) return;

    set({ chronicleLoading: true, error: "" });
    try {
      const chronicle = await requestGenerateChronicle(sessionId);
      set((state) => ({
        chronicles: [chronicle, ...state.chronicles],
        chronicleLoading: false
      }));
      get().appendLog(`史官落笔：本世回望 #${chronicle.id} 已生成。`);
      void get().refreshMilestones();
    } catch {
      set({ chronicleLoading: false, error: "史官链路中断：未能生成回望。" });
      get().appendLog("史官失声：回望生成失败。");
    }
  },

  refreshChronicles: async () => {
    const sessionId = get().sessionId;
    if (!sessionId || get().chronicleLoading) return;

    set({ chronicleLoading: true });
    try {
      const list = await listChronicles(sessionId);
      set({ chronicles: list, chronicleLoading: false });
    } catch {
      set({ chronicleLoading: false });
      get().appendLog("史册列表刷新失败。");
    }
  },

  refreshMilestones: async () => {
    const sessionId = get().sessionId;
    if (!sessionId || get().milestonesLoading) return;

    set({ milestonesLoading: true });
    try {
      const res = await fetchMilestones(sessionId);
      set({ milestones: res.catalog, milestonesTotal: res.total, milestonesLoading: false });
    } catch {
      set({ milestonesLoading: false });
    }
  }
});
