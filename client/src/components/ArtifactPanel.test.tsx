import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArtifactPanel } from "./ArtifactPanel";
import { resetGameStoreForTests, useGameStore } from "../state/store";

const sampleArtifact = {
  id: "fentian_ling",
  name: "焚天令",
  description: "白璃丹炉旧令。",
  visibleTag: "佩焚天令",
  equipped: false
};

describe("ArtifactPanel", () => {
  beforeEach(() => {
    resetGameStoreForTests();
    useGameStore.setState({
      refreshArtifacts: vi.fn().mockResolvedValue(undefined),
      equipArtifact: vi.fn().mockResolvedValue(undefined),
      unequipArtifact: vi.fn().mockResolvedValue(undefined)
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows scanning indicator while loading with no artifacts", () => {
    useGameStore.setState({ sessionId: "s1", artifacts: [], artifactsLoading: true });
    render(<ArtifactPanel />);
    expect(screen.getByText(/望气法宝/)).toBeTruthy();
  });

  it("shows empty-state copy when no artifacts are owned", () => {
    useGameStore.setState({ sessionId: "s1", artifacts: [], artifactsLoading: false });
    render(<ArtifactPanel />);
    expect(screen.getByText(/还没拿到任何法宝/)).toBeTruthy();
  });

  it("renders owned artifacts with name + description", () => {
    useGameStore.setState({
      sessionId: "s1",
      artifacts: [sampleArtifact],
      artifactsLoading: false
    });

    render(<ArtifactPanel />);
    expect(screen.getByText("焚天令")).toBeTruthy();
    expect(screen.getByText(/白璃丹炉旧令/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "佩戴" })).toBeTruthy();
  });

  it("shows equipped state with aria-pressed=true and 已佩戴 label", () => {
    useGameStore.setState({
      sessionId: "s1",
      artifacts: [{ ...sampleArtifact, equipped: true }]
    });

    render(<ArtifactPanel />);
    const button = screen.getByRole("button", { name: "已佩戴" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("calls equipArtifact when 佩戴 is clicked", async () => {
    const equipSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({
      sessionId: "s1",
      artifacts: [sampleArtifact],
      equipArtifact: equipSpy
    });

    render(<ArtifactPanel />);
    fireEvent.click(screen.getByRole("button", { name: "佩戴" }));
    await waitFor(() => {
      expect(equipSpy).toHaveBeenCalledWith("fentian_ling");
    });
  });

  it("calls unequipArtifact when 已佩戴 is clicked", async () => {
    const unequipSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({
      sessionId: "s1",
      artifacts: [{ ...sampleArtifact, equipped: true }],
      unequipArtifact: unequipSpy
    });

    render(<ArtifactPanel />);
    fireEvent.click(screen.getByRole("button", { name: "已佩戴" }));
    await waitFor(() => {
      expect(unequipSpy).toHaveBeenCalledWith("fentian_ling");
    });
  });

  it("calls refreshArtifacts on mount when sessionId is set", async () => {
    const refreshSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({ sessionId: "s1", refreshArtifacts: refreshSpy });

    render(<ArtifactPanel />);
    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  it("does NOT call refreshArtifacts when sessionId is empty", () => {
    const refreshSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({ sessionId: "", refreshArtifacts: refreshSpy });

    render(<ArtifactPanel />);
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});
