import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SceneBackdrop } from "./SceneBackdrop";
import { resetGameStoreForTests, useGameStore } from "../state/store";

const scene = (sceneId: string, name: string, description: string) => ({
  sceneId,
  name,
  description,
  backgroundAsset: "",
  npcIds: [],
  unlockedByDefault: true
});

describe("SceneBackdrop", () => {
  beforeEach(() => {
    resetGameStoreForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders null when no scene matches activeSceneId", () => {
    useGameStore.setState({
      activeSceneId: "missing_scene",
      scenes: [scene("black_market", "无相黑市", "")]
    });

    const { container } = render(<SceneBackdrop />);
    expect(container.querySelector("section")).toBeNull();
  });

  it("renders the active scene's name, sceneId and description", () => {
    useGameStore.setState({
      activeSceneId: "black_market",
      scenes: [scene("black_market", "无相黑市", "九龙下城最深处的黑市。")]
    });

    render(<SceneBackdrop />);
    expect(screen.getByRole("heading", { name: "无相黑市" })).toBeTruthy();
    expect(screen.getByText("black_market")).toBeTruthy();
    expect(screen.getByText("九龙下城最深处的黑市。")).toBeTruthy();
  });

  it("sets a descriptive aria-label on the section", () => {
    useGameStore.setState({
      activeSceneId: "lower_city",
      scenes: [scene("lower_city", "九龙下城", "")]
    });

    render(<SceneBackdrop />);
    expect(screen.getByLabelText("场景背景：九龙下城")).toBeTruthy();
  });
});
