import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PlayerPanel } from "./PlayerPanel";
import { resetGameStoreForTests, useGameStore } from "../state/store";

describe("PlayerPanel", () => {
  beforeEach(() => {
    resetGameStoreForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the player's name and spirit stones", () => {
    const current = useGameStore.getState().player;
    useGameStore.setState({
      player: { ...current, name: "陆玄", spiritStones: 17 }
    });

    render(<PlayerPanel />);
    expect(screen.getByRole("heading", { name: "陆玄" })).toBeTruthy();
    expect(screen.getByText("17 灵石")).toBeTruthy();
  });

  it("shows the stage label derived from cultivationStageIdx", () => {
    const current = useGameStore.getState().player;
    useGameStore.setState({
      player: { ...current, cultivationStageIdx: 9 } // 筑基初期
    });

    render(<PlayerPanel />);
    expect(screen.getByText(/筑基初期/)).toBeTruthy();
  });

  it("shows 'syncing' when sessionId is empty, 'online' otherwise", () => {
    const current = useGameStore.getState().player;
    useGameStore.setState({ player: { ...current, sessionId: "" } });

    const { unmount } = render(<PlayerPanel />);
    expect(screen.getByText("syncing")).toBeTruthy();
    unmount();

    useGameStore.setState({ player: { ...current, sessionId: "live-session" } });
    render(<PlayerPanel />);
    expect(screen.getByText("online")).toBeTruthy();
  });

  it("renders each visible trait as a chip", () => {
    const current = useGameStore.getState().player;
    useGameStore.setState({
      player: {
        ...current,
        visibleTraits: ["右臂义体", "雷罚残痕", "非法灵根波形"]
      }
    });

    render(<PlayerPanel />);
    expect(screen.getByText("右臂义体")).toBeTruthy();
    expect(screen.getByText("雷罚残痕")).toBeTruthy();
    expect(screen.getByText("非法灵根波形")).toBeTruthy();
  });

  it("renders qi pool ratio (qiCurrent/qiCap) in the sublabel", () => {
    const current = useGameStore.getState().player;
    useGameStore.setState({
      player: { ...current, qiCurrent: 45, qiCap: 100 }
    });

    render(<PlayerPanel />);
    expect(screen.getByText(/45\/100/)).toBeTruthy();
  });
});
