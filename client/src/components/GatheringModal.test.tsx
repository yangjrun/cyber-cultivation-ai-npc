import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GatheringModal } from "./GatheringModal";
import { resetGameStoreForTests, useGameStore } from "../state/store";
import type { GatheringPointInfo } from "../api/gatheringApi";

function makePoint(overrides: Partial<GatheringPointInfo> = {}): GatheringPointInfo {
  return {
    pointId: "black_market_herbs",
    name: "废弃药摊",
    description: "黑市角落的废弃药摊。",
    qiCost: 10,
    cooldownHours: 6,
    alertRisk: 1,
    available: true,
    nextAvailableAt: null,
    ...overrides
  };
}

describe("GatheringModal", () => {
  beforeEach(() => {
    resetGameStoreForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when gatheringModalOpen=false", () => {
    const { container } = render(<GatheringModal />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("renders gathering points when open", () => {
    useGameStore.setState({
      gatheringModalOpen: true,
      gatheringPoints: [makePoint()],
      player: { ...useGameStore.getState().player, qiCurrent: 100, qiCap: 100 }
    });

    render(<GatheringModal />);
    expect(screen.getByRole("dialog", { name: "采集" })).toBeTruthy();
    expect(screen.getByText("废弃药摊")).toBeTruthy();
    expect(screen.getByText(/耗气 10/)).toBeTruthy();
  });

  it("shows alert risk warning for risky points", () => {
    useGameStore.setState({
      gatheringModalOpen: true,
      gatheringPoints: [makePoint({ alertRisk: 5 })],
      player: { ...useGameStore.getState().player, qiCurrent: 100, qiCap: 100 }
    });

    render(<GatheringModal />);
    expect(screen.getByText(/天道警戒 \+5/)).toBeTruthy();
  });

  it("clicking 采集 fires gatherFromPoint", async () => {
    const gatherSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({
      gatheringModalOpen: true,
      gatheringPoints: [makePoint()],
      player: { ...useGameStore.getState().player, qiCurrent: 100, qiCap: 100 },
      gatherFromPoint: gatherSpy
    });

    render(<GatheringModal />);
    const button = screen.getByRole("button", { name: "采集" });
    await userEvent.click(button);

    expect(gatherSpy).toHaveBeenCalledWith("black_market_herbs");
  });

  it("disables gather button when point is on cooldown", () => {
    useGameStore.setState({
      gatheringModalOpen: true,
      gatheringPoints: [makePoint({ available: false, nextAvailableAt: "2026-05-30T12:00:00.000Z" })],
      player: { ...useGameStore.getState().player, qiCurrent: 100, qiCap: 100 }
    });

    render(<GatheringModal />);
    const button = screen.getByRole("button", { name: "冷却中" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("disables gather button when qi is insufficient", () => {
    useGameStore.setState({
      gatheringModalOpen: true,
      gatheringPoints: [makePoint({ qiCost: 50 })],
      player: { ...useGameStore.getState().player, qiCurrent: 10, qiCap: 100 }
    });

    render(<GatheringModal />);
    const button = screen.getByRole("button", { name: "灵气不足" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("shows empty message when no points available", () => {
    useGameStore.setState({
      gatheringModalOpen: true,
      gatheringPoints: [],
      gatheringLoading: false
    });

    render(<GatheringModal />);
    expect(screen.getByText("此地没有可采集的资源。")).toBeTruthy();
  });

  it("renders gathering result when present", () => {
    useGameStore.setState({
      gatheringModalOpen: true,
      gatheringPoints: [makePoint()],
      lastGatheringResult: "采集成功，获得：影髓草 ×2。",
      player: { ...useGameStore.getState().player, qiCurrent: 100, qiCap: 100 }
    });

    render(<GatheringModal />);
    expect(screen.getByTestId("gathering-result")).toBeTruthy();
    expect(screen.getByText("采集成功，获得：影髓草 ×2。")).toBeTruthy();
  });
});
