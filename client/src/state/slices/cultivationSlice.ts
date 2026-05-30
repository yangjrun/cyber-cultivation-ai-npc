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
      const capped = response.player.qiCurrent >= response.player.qiCap;
      const message = response.qiGained > 0
        ? `+${response.qiGained} 灵气${capped ? "（已满，可尝试突破）" : ""}。`
        : capped
          ? "灵气已满，请尝试突破。"
          : response.message || "打坐完成。";
      set((state) => ({
        player: response.player,
        lastCultivationResult: message,
        lastBreakthroughResult: "",
        cultivationResultTick: state.cultivationResultTick + 1
      }));
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
        lastBreakthroughResult: response.message,
        lastCultivationResult: "",
        cultivationResultTick: state.cultivationResultTick + 1
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
