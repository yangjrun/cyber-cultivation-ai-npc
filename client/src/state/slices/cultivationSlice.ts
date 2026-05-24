import type { StateCreator } from "zustand";
import {
  breakthrough as requestBreakthrough,
  cultivate as requestCultivate
} from "../../api/cultivationApi";
import type { GameActions, GameStore } from "../types";
import { ensureSession } from "../utils";

type CultivationActions = Pick<GameActions, "cultivate" | "breakthrough">;

export const createCultivationSlice: StateCreator<GameStore, [], [], CultivationActions> = (
  set,
  get
) => ({
  cultivate: async (duration: number) => {
    const sessionId = await ensureSession(get);

    if (!sessionId) {
      return;
    }

    set({ cultivationLoading: true, error: "" });

    try {
      const response = await requestCultivate(sessionId, duration);
      set({ player: response.player, lastCultivationResult: response.message });
      get().appendLog(`打坐完成：+${response.qiGained} 灵气。`);
    } catch {
      set({ error: "修炼链路中断：打坐失败。" });
      get().appendLog("修炼失败：后端未响应。");
    } finally {
      set({ cultivationLoading: false });
    }
  },

  breakthrough: async () => {
    const sessionId = await ensureSession(get);

    if (!sessionId) {
      return;
    }

    set({ breakthroughLoading: true, error: "" });

    try {
      const response = await requestBreakthrough(sessionId);
      const activeNpcId = get().activeNpcId;

      set((state) => ({
        player: response.player,
        npcStates: response.npcState
          ? { ...state.npcStates, [activeNpcId]: response.npcState }
          : state.npcStates,
        lastBreakthroughResult: response.message
      }));
      get().appendLog(`突破结果：${response.message}`);
    } catch {
      set({ error: "突破链路中断：请稍后再试。" });
      get().appendLog("突破失败：后端未响应。");
    } finally {
      set({ breakthroughLoading: false });
    }
  }
});
