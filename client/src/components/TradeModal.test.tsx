import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TradeModal } from "./TradeModal";
import { resetGameStoreForTests, useGameStore } from "../state/store";
import type { ShopSnapshot } from "../api/tradeApi";

function makeShop(overrides: Partial<ShopSnapshot> = {}): ShopSnapshot {
  return {
    npcId: "baili",
    npcName: "白璃",
    npcSpiritStones: 800,
    refused: false,
    reason: null,
    items: [
      {
        itemId: "cheap_qi_pill",
        item: { id: "cheap_qi_pill", name: "粗制回气丹", type: "pill", description: "回气。", basePrice: 30 },
        quantity: 5,
        buyUnitPrice: 30
      }
    ],
    sellQuotes: [
      {
        itemId: "shadow_herb",
        item: { id: "shadow_herb", name: "影髓草", type: "material", description: "材料。", basePrice: 18 },
        quantity: 3,
        sellUnitPrice: 12
      }
    ],
    ...overrides
  };
}

describe("TradeModal", () => {
  beforeEach(() => {
    resetGameStoreForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when tradeModalOpen=false", () => {
    const { container } = render(<TradeModal />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("renders buy list with prices when open", () => {
    useGameStore.setState({ tradeModalOpen: true, shop: makeShop(), player: { ...useGameStore.getState().player, spiritStones: 1000 } });

    render(<TradeModal />);
    expect(screen.getByRole("dialog", { name: "交易" })).toBeTruthy();
    expect(screen.getByText("粗制回气丹")).toBeTruthy();
    expect(screen.getByTestId("trade-buy-cheap_qi_pill")).toBeTruthy();
  });

  it("clicking 买入 fires buyTradeItem", async () => {
    const buySpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({
      tradeModalOpen: true,
      shop: makeShop(),
      buyTradeItem: buySpy,
      player: { ...useGameStore.getState().player, spiritStones: 1000 }
    });

    render(<TradeModal />);
    await userEvent.click(screen.getByTestId("trade-buy-cheap_qi_pill"));
    expect(buySpy).toHaveBeenCalledWith("cheap_qi_pill", 1);
  });

  it("disables buy when player cannot afford", () => {
    useGameStore.setState({
      tradeModalOpen: true,
      shop: makeShop(),
      player: { ...useGameStore.getState().player, spiritStones: 5 }
    });

    render(<TradeModal />);
    const button = screen.getByTestId("trade-buy-cheap_qi_pill") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("switches to sell tab and fires sellTradeItem", async () => {
    const sellSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({ tradeModalOpen: true, shop: makeShop(), sellTradeItem: sellSpy });

    render(<TradeModal />);
    await userEvent.click(screen.getByRole("button", { name: "卖出" }));
    await userEvent.click(screen.getByTestId("trade-sell-shadow_herb"));
    expect(sellSpy).toHaveBeenCalledWith("shadow_herb", 1);
  });

  it("shows refusal banner and disables buy when refused", () => {
    useGameStore.setState({
      tradeModalOpen: true,
      shop: makeShop({ refused: true, reason: "对方怒气冲天，根本不愿与你交易。" }),
      player: { ...useGameStore.getState().player, spiritStones: 1000 }
    });

    render(<TradeModal />);
    expect(screen.getByTestId("trade-refused").textContent).toContain("怒气冲天");
    const button = screen.getByTestId("trade-buy-cheap_qi_pill") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("clicking 关闭 fires closeTradeModal", async () => {
    const closeSpy = vi.fn();
    useGameStore.setState({ tradeModalOpen: true, shop: makeShop(), closeTradeModal: closeSpy });

    render(<TradeModal />);
    await userEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
