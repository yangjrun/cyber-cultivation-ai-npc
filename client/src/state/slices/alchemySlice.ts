import type { StateCreator } from "zustand";
import {
  refineAlchemy as requestRefineAlchemy,
  type MaterialSelection
} from "../../api/alchemyApi";
import { consumeInventoryItem } from "../../api/inventoryApi";
import type { GameActions, GameStore } from "../types";
import { ensureSession } from "../utils";

type AlchemyActions = Pick<
  GameActions,
  "refineAlchemy" | "consumeItem" | "openAlchemyModal" | "closeAlchemyModal"
>;

export const createAlchemySlice: StateCreator<GameStore, [], [], AlchemyActions> = (set, get) => ({
  refineAlchemy: async (recipeId: string, materials: MaterialSelection[], fireLevel: number) => {
    const sessionId = await ensureSession(get);

    if (!sessionId) {
      return;
    }

    set({ alchemyLoading: true, error: "" });

    try {
      const response = await requestRefineAlchemy(sessionId, recipeId, materials, fireLevel);
      const qualityLabel = formatQualityLabel(response.quality);
      const productName = response.resultItem?.name;
      const detail = [qualityLabel, productName ? `产物 ${productName}` : null]
        .filter(Boolean)
        .join(" / ");
      const message = detail ? `${response.message}（${detail}）` : response.message;
      set((state) => ({
        inventory: response.inventory,
        lastAlchemyResult: message,
        alchemyResultTick: state.alchemyResultTick + 1
      }));
      get().appendLog(`炼丹结果：${message}`);
    } catch {
      set({ error: "炼丹链路中断：材料或炉火出了问题。" });
      get().appendLog("炼丹失败：后端拒绝结算。");
    } finally {
      set({ alchemyLoading: false });
    }
  },

  consumeItem: async (itemId: string) => {
    const sessionId = await ensureSession(get);

    if (!sessionId) {
      return;
    }

    set({ alchemyLoading: true, error: "" });

    try {
      const response = await consumeInventoryItem(sessionId, itemId);
      const activeNpcId = get().activeNpcId;

      set((state) => ({
        player: response.player,
        npcStates: response.npcState
          ? { ...state.npcStates, [activeNpcId]: response.npcState }
          : state.npcStates,
        inventory: response.inventory,
        lastAlchemyResult: response.message,
        alchemyResultTick: state.alchemyResultTick + 1
      }));
      get().appendLog(`服用物品：${response.message}`);
    } catch {
      set({ error: "物品使用失败。" });
      get().appendLog("背包结算失败：无法使用物品。");
    } finally {
      set({ alchemyLoading: false });
    }
  },

  openAlchemyModal: () => {
    set({ alchemyModalOpen: true });
  },

  closeAlchemyModal: () => {
    set({ alchemyModalOpen: false });
  }
});

function formatQualityLabel(quality: string): string {
  switch (quality) {
    case "perfect":
      return "上品";
    case "fine":
      return "良品";
    case "common":
      return "普通";
    case "failed":
      return "失败";
    default:
      return quality;
  }
}
