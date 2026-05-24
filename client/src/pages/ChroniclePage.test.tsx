import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ChroniclePage } from "./ChroniclePage";
import { resetGameStoreForTests, useGameStore } from "../state/store";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/chronicle"]}>
      <ChroniclePage />
    </MemoryRouter>
  );
}

describe("ChroniclePage", () => {
  beforeEach(() => {
    resetGameStoreForTests();
    // Stub network-bound action so the useEffect doesn't flip loading state.
    useGameStore.setState({
      refreshChronicles: vi.fn().mockResolvedValue(undefined)
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows placeholder when there are no chronicles", () => {
    useGameStore.setState({ sessionId: "test-session" });
    renderPage();
    expect(screen.getByText("史官还没为你写过任何回望。")).toBeTruthy();
  });

  it("renders each chronicle entry with id, timestamp and content", () => {
    useGameStore.setState({
      sessionId: "test-session",
      chronicles: [
        {
          id: 2,
          sessionId: "test-session",
          content: "你这一世走完了九龙下城。",
          milestonesSnapshot: ["market_regular", "lei_survivor"],
          createdAt: "2026-05-24T10:00:00Z"
        },
        {
          id: 1,
          sessionId: "test-session",
          content: "你这一世第一次回望。",
          milestonesSnapshot: [],
          createdAt: "2026-05-24T09:00:00Z"
        }
      ]
    });

    renderPage();
    expect(screen.getByText(/回望 #2/)).toBeTruthy();
    expect(screen.getByText(/回望 #1/)).toBeTruthy();
    expect(screen.getByText("你这一世走完了九龙下城。")).toBeTruthy();
    expect(screen.getByText("market_regular")).toBeTruthy();
    expect(screen.getByText("lei_survivor")).toBeTruthy();
  });

  it("clicking the button calls generateChronicle", async () => {
    const generateSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({ sessionId: "test-session", generateChronicle: generateSpy });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /回望本世/ }));
    expect(generateSpy).toHaveBeenCalledTimes(1);
  });

  it("button shows 落笔中... and is disabled while chronicleLoading=true", () => {
    useGameStore.setState({ sessionId: "test-session", chronicleLoading: true });
    renderPage();

    const button = screen.getByRole("button", { name: /落笔中/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("button is disabled when no sessionId", () => {
    useGameStore.setState({ sessionId: "" });
    renderPage();

    const button = screen.getByRole("button", { name: /回望本世/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("calls refreshChronicles when sessionId becomes available", async () => {
    const refreshSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({ sessionId: "test-session", refreshChronicles: refreshSpy });

    renderPage();
    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalled();
    });
  });
});
