import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetGameStoreForTests, useGameStore } from "../store";
import type { ShopSnapshot, TradeActionResponse } from "../../api/tradeApi";

vi.mock("../../api/tradeApi", () => ({
  fetchShop: vi.fn(),
  buyItem: vi.fn(),
  sellItem: vi.fn()
}));

vi.mock("../utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils")>();
  return { ...actual, ensureSession: vi.fn().mockResolvedValue("s1") };
});

import { buyItem, fetchShop } from "../../api/tradeApi";

const emptyShop = (overrides: Partial<ShopSnapshot> = {}): ShopSnapshot => ({
  npcId: "baili",
  npcName: "白璃",
  npcSpiritStones: 800,
  refused: false,
  reason: null,
  items: [],
  sellQuotes: [],
  ...overrides
});

describe("tradeSlice", () => {
  beforeEach(() => {
    resetGameStoreForTests();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("openTradeModal sets npc + opens, then loads the shop", async () => {
    vi.mocked(fetchShop).mockResolvedValue(emptyShop());

    await useGameStore.getState().openTradeModal("baili");

    const state = useGameStore.getState();
    expect(state.tradeModalOpen).toBe(true);
    expect(state.tradeNpcId).toBe("baili");
    expect(state.shop?.npcName).toBe("白璃");
    expect(fetchShop).toHaveBeenCalledWith("s1", "baili");
  });

  it("closeTradeModal clears the shop", () => {
    useGameStore.setState({ tradeModalOpen: true, shop: emptyShop() });
    useGameStore.getState().closeTradeModal();

    expect(useGameStore.getState().tradeModalOpen).toBe(false);
    expect(useGameStore.getState().shop).toBeNull();
  });

  it("buyTradeItem applies player/inventory/shop/npcState immutably", async () => {
    const response: TradeActionResponse = {
      kind: "buy",
      itemId: "cheap_qi_pill",
      item: null,
      quantity: 1,
      unitPrice: 31,
      totalPrice: 31,
      player: { ...useGameStore.getState().player, spiritStones: 969 },
      inventory: [{ itemId: "cheap_qi_pill", quantity: 2, item: null }],
      npcState: { trust: 21, fear: 10, anger: 0, tianDaoAlert: 45 },
      shop: emptyShop({ npcSpiritStones: 831 }),
      message: "以 31 灵石购入 粗制回气丹 ×1。"
    };
    vi.mocked(buyItem).mockResolvedValue(response);
    useGameStore.setState({ tradeNpcId: "baili" });

    const npcStatesBefore = useGameStore.getState().npcStates;

    await useGameStore.getState().buyTradeItem("cheap_qi_pill", 1);

    const state = useGameStore.getState();
    expect(state.player.spiritStones).toBe(969);
    expect(state.inventory).toEqual(response.inventory);
    expect(state.shop?.npcSpiritStones).toBe(831);
    expect(state.npcStates.baili).toEqual(response.npcState);
    expect(state.npcStates).not.toBe(npcStatesBefore);
    expect(state.lastTradeResult).toContain("购入");
    expect(state.tradeResultTick).toBe(1);
  });
});
