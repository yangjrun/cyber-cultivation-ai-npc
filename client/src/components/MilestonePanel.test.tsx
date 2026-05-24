import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MilestonePanel } from "./MilestonePanel";
import { resetGameStoreForTests, useGameStore } from "../state/store";

describe("MilestonePanel", () => {
  beforeEach(() => {
    resetGameStoreForTests();
    // Default stub: don't hit real network during useEffect.
    useGameStore.setState({
      refreshMilestones: vi.fn().mockResolvedValue(undefined)
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows scanning indicator while loading with no milestones", () => {
    useGameStore.setState({ sessionId: "s1", milestones: [], milestonesLoading: true });
    render(<MilestonePanel />);
    expect(screen.getByText("扫描中...")).toBeTruthy();
  });

  it("shows empty-state copy when no milestones are unlocked", () => {
    useGameStore.setState({ sessionId: "s1", milestones: [], milestonesLoading: false });
    render(<MilestonePanel />);
    expect(screen.getByText(/还没刻下任何里程碑/)).toBeTruthy();
  });

  it("renders unlocked milestones with title + description", () => {
    useGameStore.setState({
      sessionId: "s1",
      milestones: [
        {
          id: "market_regular",
          title: "黑市常客",
          description: "和黑市做了 5 次以上的成单交易。",
          unlockedAt: "2026-05-24T10:00:00Z"
        }
      ],
      milestonesTotal: 8
    });

    render(<MilestonePanel />);
    expect(screen.getByText("黑市常客")).toBeTruthy();
    expect(screen.getByText(/和黑市做了 5 次以上/)).toBeTruthy();
    expect(screen.getByText("1 / 8")).toBeTruthy();
  });

  it("calls refreshMilestones on mount when sessionId is set", async () => {
    const refreshSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({ sessionId: "s1", refreshMilestones: refreshSpy });

    render(<MilestonePanel />);
    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  it("does NOT call refreshMilestones when sessionId is empty", () => {
    const refreshSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({ sessionId: "", refreshMilestones: refreshSpy });

    render(<MilestonePanel />);
    // Synchronously: useEffect has run but condition skipped the call
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});
