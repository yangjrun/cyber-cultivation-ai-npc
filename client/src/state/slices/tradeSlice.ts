import type { StateCreator } from "zustand";
import { buyItem, fetchShop, sellItem } from "../../api/tradeApi";
import type { GameActions, GameStore } from "../types";
import { ensureSession } from "../utils";

type TradeActions = Pick<
  GameActions,
  "openTradeModal" | "closeTradeModal" | "refreshShop" | "buyTradeItem" | "sellTradeItem"
>;

export const createTradeSlice: StateCreator<GameStore, [], [], TradeActions> = (set, get) => ({
  openTradeModal: async (npcId: string) => {
    set({ tradeModalOpen: true, tradeNpcId: npcId, shop: null });
    await get().refreshShop();
  },

  closeTradeModal: () => {
    set({ tradeModalOpen: false, shop: null });
  },

  refreshShop: async () => {
    const sessionId = await ensureSession(get);
    const npcId = get().tradeNpcId;

    if (!sessionId || !npcId) {
      return;
    }

    set({ tradeLoading: true, error: "" });

    try {
      const shop = await fetchShop(sessionId, npcId);
      set({ shop });
    } catch {
      set({ error: "无法加载商店信息。" });
      get().appendLog("交易失败：无法加载商店。");
    } finally {
      set({ tradeLoading: false });
    }
  },

  buyTradeItem: async (itemId: string, quantity: number) => {
    await settleTrade(set, get, "buy", itemId, quantity);
  },

  sellTradeItem: async (itemId: string, quantity: number) => {
    await settleTrade(set, get, "sell", itemId, quantity);
  }
});

async function settleTrade(
  set: Parameters<typeof createTradeSlice>[0],
  get: Parameters<typeof createTradeSlice>[1],
  kind: "buy" | "sell",
  itemId: string,
  quantity: number
): Promise<void> {
  const sessionId = await ensureSession(get);
  const npcId = get().tradeNpcId;

  if (!sessionId || !npcId) {
    return;
  }

  set({ tradeLoading: true, error: "" });

  try {
    const response = kind === "buy"
      ? await buyItem(sessionId, npcId, itemId, quantity)
      : await sellItem(sessionId, npcId, itemId, quantity);

    set((state) => ({
      player: response.player,
      inventory: response.inventory,
      shop: response.shop,
      npcStates: response.npcState
        ? { ...state.npcStates, [npcId]: response.npcState }
        : state.npcStates,
      lastTradeResult: response.message,
      tradeResultTick: state.tradeResultTick + 1
    }));
    get().appendLog(`交易：${response.message}`);
  } catch {
    const label = kind === "buy" ? "买入" : "卖出";
    set({ error: `${label}失败：后端拒绝结算。` });
    get().appendLog(`交易失败：${label}未成交。`);
    await get().refreshShop();
  } finally {
    set({ tradeLoading: false });
  }
}
