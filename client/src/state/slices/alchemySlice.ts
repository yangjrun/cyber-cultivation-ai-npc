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
      set({
        inventory: response.inventory,
        lastAlchemyResult: response.message,
        alchemyModalOpen: false
      });
      get().appendLog(`炼丹结果：${response.message}`);
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
        lastAlchemyResult: response.message
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
