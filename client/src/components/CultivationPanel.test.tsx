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
    expect(screen.getByText(/天道镜警戒过高，突破会触发雷罚反噬/)).toBeTruthy();
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

  it("disables 打坐 when qiCurrent >= qiCap and shows 灵气已满 hint", () => {
    const current = useGameStore.getState().player;
    useGameStore.setState({ player: { ...current, qiCurrent: 100, qiCap: 100 } });

    render(<CultivationPanel />);
    const cultivateBtn = screen.getByRole("button", { name: /灵气已满/ }) as HTMLButtonElement;
    expect(cultivateBtn.disabled).toBe(true);
    expect(screen.getByText(/灵气已满，继续打坐不会再涨/)).toBeTruthy();
  });

  it("remounts result text when cultivationResultTick changes (forces re-render)", () => {
    useGameStore.setState({ lastCultivationResult: "+0 灵气。", cultivationResultTick: 1 });
    const { rerender } = render(<CultivationPanel />);
    const first = screen.getByTestId("cultivation-result");

    useGameStore.setState({ lastCultivationResult: "+0 灵气。", cultivationResultTick: 2 });
    rerender(<CultivationPanel />);
    const second = screen.getByTestId("cultivation-result");

    expect(second).not.toBe(first);
  });

  it("hides 凝聚灵石 button for 练气期 players (stage idx < 9)", () => {
    const current = useGameStore.getState().player;
    useGameStore.setState({ player: { ...current, cultivationStageIdx: 0 } });

    render(<CultivationPanel />);
    expect(screen.queryByRole("button", { name: /凝聚灵石/ })).toBeNull();
  });

  it("shows 凝聚灵石 button for 筑基期 and above (stage idx >= 9)", () => {
    const current = useGameStore.getState().player;
    useGameStore.setState({ player: { ...current, cultivationStageIdx: 9 } });

    render(<CultivationPanel />);
    expect(screen.getByRole("button", { name: /凝聚灵石/ })).toBeTruthy();
  });

  it("clicking 凝聚灵石 fires claimPassiveIncome", async () => {
    const claimSpy = vi.fn().mockResolvedValue(undefined);
    const current = useGameStore.getState().player;
    useGameStore.setState({
      player: { ...current, cultivationStageIdx: 12 },
      claimPassiveIncome: claimSpy
    });

    render(<CultivationPanel />);
    await userEvent.click(screen.getByRole("button", { name: /凝聚灵石/ }));
    expect(claimSpy).toHaveBeenCalled();
  });

  it("shows passive income result text when present", () => {
    const current = useGameStore.getState().player;
    useGameStore.setState({
      player: { ...current, cultivationStageIdx: 9 },
      lastPassiveIncomeResult: "凝聚了 2 日灵气，入账 10 灵石。"
    });

    render(<CultivationPanel />);
    expect(screen.getByTestId("passive-income-result")).toBeTruthy();
    expect(screen.getByText("凝聚了 2 日灵气，入账 10 灵石。")).toBeTruthy();
  });
});
