import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
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

  it("shows '同步中' when sessionId is empty, '在线' otherwise", () => {
    const current = useGameStore.getState().player;
    useGameStore.setState({ player: { ...current, sessionId: "" } });

    const { unmount } = render(<PlayerPanel />);
    expect(screen.getByText("同步中")).toBeTruthy();
    unmount();

    useGameStore.setState({ player: { ...current, sessionId: "live-session" } });
    render(<PlayerPanel />);
    expect(screen.getByText("在线")).toBeTruthy();
  });

  it("shows expand/collapse button and toggles details", async () => {
    const user = userEvent.setup();
    render(<PlayerPanel />);

    // Initially collapsed
    expect(screen.getByText("展开详情 ▼")).toBeTruthy();
    expect(screen.queryByText("灵气池")).toBeNull();

    // Click to expand
    await user.click(screen.getByText("展开详情 ▼"));
    expect(screen.getByText("收起详情 ▲")).toBeTruthy();
    expect(screen.getByText("灵气池")).toBeTruthy();

    // Click to collapse
    await user.click(screen.getByText("收起详情 ▲"));
    expect(screen.getByText("展开详情 ▼")).toBeTruthy();
    expect(screen.queryByText("灵气池")).toBeNull();
  });

  it("renders each visible trait as a chip when expanded", async () => {
    const user = userEvent.setup();
    const current = useGameStore.getState().player;
    useGameStore.setState({
      player: {
        ...current,
        visibleTraits: ["右臂经脉", "雷罚残痕", "非法灵根烙印"]
      }
    });

    render(<PlayerPanel />);

    // Traits not visible when collapsed
    expect(screen.queryByText("右臂经脉")).toBeNull();

    // Expand to see traits
    await user.click(screen.getByText("展开详情 ▼"));
    expect(screen.getByText("右臂经脉")).toBeTruthy();
    expect(screen.getByText("雷罚残痕")).toBeTruthy();
    expect(screen.getByText("非法灵根烙印")).toBeTruthy();
  });

  it("renders qi pool ratio (qiCurrent/qiCap) in the sublabel when expanded", async () => {
    const user = userEvent.setup();
    const current = useGameStore.getState().player;
    useGameStore.setState({
      player: { ...current, qiCurrent: 45, qiCap: 100 }
    });

    render(<PlayerPanel />);

    // Not visible when collapsed
    expect(screen.queryByText(/45\/100/)).toBeNull();

    // Expand to see qi pool
    await user.click(screen.getByText("展开详情 ▼"));
    expect(screen.getByText(/45\/100/)).toBeTruthy();
  });
});
