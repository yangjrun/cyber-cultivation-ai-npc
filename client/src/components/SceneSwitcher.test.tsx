import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SceneSwitcher } from "./SceneSwitcher";
import { resetGameStoreForTests, useGameStore } from "../state/store";

const sampleScenes = [
  {
    sceneId: "black_market",
    name: "无相黑市",
    description: "",
    backgroundAsset: "",
    npcIds: ["baili"],
    unlockedByDefault: true
  },
  {
    sceneId: "lower_city",
    name: "九龙下城",
    description: "",
    backgroundAsset: "",
    npcIds: ["chimu"],
    unlockedByDefault: true
  }
];

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={["/play"]}>
      <SceneSwitcher />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("SceneSwitcher", () => {
  beforeEach(() => {
    resetGameStoreForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when there are no scenes", () => {
    const { container } = renderWithRouter();
    expect(container.querySelector('nav[aria-label="场景切换"]')).toBeNull();
  });

  it("renders one button per scene and marks the active one with aria-pressed", () => {
    useGameStore.setState({ scenes: sampleScenes, activeSceneId: "black_market" });
    renderWithRouter();

    const blackMarket = screen.getByRole("button", { name: "无相黑市" });
    const lowerCity = screen.getByRole("button", { name: "九龙下城" });

    expect(blackMarket.getAttribute("aria-pressed")).toBe("true");
    expect(lowerCity.getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking an inactive scene fires switchScene and navigates to /play/scene/:id", async () => {
    const switchSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({
      scenes: sampleScenes,
      activeSceneId: "black_market",
      switchScene: switchSpy
    });

    renderWithRouter();
    await userEvent.click(screen.getByRole("button", { name: "九龙下城" }));

    expect(switchSpy).toHaveBeenCalledWith("lower_city");
    expect(screen.getByTestId("location-probe").textContent).toBe("/play/scene/lower_city");
  });

  it("clicking the active scene does NOT call switchScene", async () => {
    const switchSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({
      scenes: sampleScenes,
      activeSceneId: "black_market",
      switchScene: switchSpy
    });

    renderWithRouter();
    await userEvent.click(screen.getByRole("button", { name: "无相黑市" }));
    expect(switchSpy).not.toHaveBeenCalled();
  });
});
