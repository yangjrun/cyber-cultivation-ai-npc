import type { StateCreator } from "zustand";
import { claimPassiveIncome as requestClaimPassiveIncome } from "../../api/economyApi";
import type { GameActions, GameStore } from "../types";
import { ensureSession } from "../utils";

type EconomyActions = Pick<GameActions, "claimPassiveIncome">;

export const createEconomySlice: StateCreator<GameStore, [], [], EconomyActions> = (set, get) => ({
  claimPassiveIncome: async () => {
    const sessionId = await ensureSession(get);

    if (!sessionId) {
      return;
    }

    set({ passiveIncomeLoading: true, error: "" });

    try {
      const response = await requestClaimPassiveIncome(sessionId);

      set((state) => ({
        player: response.player,
        lastPassiveIncomeResult: response.message,
        passiveIncomeResultTick: state.passiveIncomeResultTick + 1
      }));
      get().appendLog(`凝聚灵石：${response.message}`);
    } catch {
      set({ error: "凝聚灵石失败：后端拒绝结算。" });
      get().appendLog("凝聚灵石失败。");
    } finally {
      set({ passiveIncomeLoading: false });
    }
  }
});
