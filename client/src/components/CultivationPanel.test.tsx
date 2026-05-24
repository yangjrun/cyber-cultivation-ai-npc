import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CultivationPanel } from "./CultivationPanel";
import { resetGameStoreForTests, useGameStore } from "../state/store";

describe("CultivationPanel", () => {
  beforeEach(() => {
    resetGameStoreForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it("disables 尝试突破 when qiCurrent < qiCap", () => {
    const current = useGameStore.getState().player;
    useGameStore.setState({ player: { ...current, qiCurrent: 50, qiCap: 100 } });

    render(<CultivationPanel />);
    const breakthroughBtn = screen.getByRole("button", { name: /尝试突破/ }) as HTMLButtonElement;
    expect(breakthroughBtn.disabled).toBe(true);
  });

  it("enables 尝试突破 when qiCurrent >= qiCap and not loading", () => {
    const current = useGameStore.getState().player;
    useGameStore.setState({ player: { ...current, qiCurrent: 100, qiCap: 100 } });

    render(<CultivationPanel />);
    const breakthroughBtn = screen.getByRole("button", { name: /尝试突破/ }) as HTMLButtonElement;
    expect(breakthroughBtn.disabled).toBe(false);
  });

  it("clicking 打坐 30 秒 fires cultivate(30)", async () => {
    const cultivateSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({ cultivate: cultivateSpy });

    render(<CultivationPanel />);
    await userEvent.click(screen.getByRole("button", { name: /打坐 30 秒/ }));
    expect(cultivateSpy).toHaveBeenCalledWith(30);
  });

  it("shows tianDao warning text when activeNpc.tianDaoAlert >= 70", () => {
    useGameStore.setState({
      activeNpcId: "baili",
      npcStates: { baili: { trust: 0, fear: 0, anger: 0, tianDaoAlert: 80 } }
    });

    render(<CultivationPanel />);
    expect(screen.getByText(/天道云警戒过高，突破会触发雷罚反噬/)).toBeTruthy();
  });

  it("shows breakthrough result preferentially over cultivation result", () => {
    useGameStore.setState({
      lastCultivationResult: "灵气提升。",
      lastBreakthroughResult: "突破成功，进入筑基初期。"
    });

    render(<CultivationPanel />);
    expect(screen.getByText("突破成功，进入筑基初期。")).toBeTruthy();
    expect(screen.queryByText("灵气提升。")).toBeNull();
  });
});
