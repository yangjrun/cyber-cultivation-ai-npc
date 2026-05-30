import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlchemyModal } from "./AlchemyModal";
import { resetGameStoreForTests, useGameStore } from "../state/store";

describe("AlchemyModal", () => {
  beforeEach(() => {
    resetGameStoreForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when alchemyModalOpen=false", () => {
    const { container } = render(<AlchemyModal />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("renders a labelled dialog with recipe + fire controls when open", () => {
    useGameStore.setState({ alchemyModalOpen: true });

    render(<AlchemyModal />);
    expect(screen.getByRole("dialog", { name: "炼丹炉" })).toBeTruthy();
    expect(screen.getByRole("combobox")).toBeTruthy(); // recipe <select>
    expect(screen.getByRole("slider")).toBeTruthy(); // fire range
    expect(screen.getByRole("button", { name: "开炉炼制" })).toBeTruthy();
  });

  it("clicking 关闭 fires closeAlchemyModal", async () => {
    const closeSpy = vi.fn();
    useGameStore.setState({ alchemyModalOpen: true, closeAlchemyModal: closeSpy });

    render(<AlchemyModal />);
    await userEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("clicking 开炉炼制 fires refineAlchemy with the current recipe + fire level", async () => {
    const refineSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({ alchemyModalOpen: true, refineAlchemy: refineSpy });

    render(<AlchemyModal />);
    await userEvent.click(screen.getByRole("button", { name: "开炉炼制" }));
    expect(refineSpy).toHaveBeenCalledTimes(1);
    const [recipeId, materials, fireLevel] = refineSpy.mock.calls[0] as [string, unknown[], number];
    expect(recipeId).toBe("cloud_veil_pill");
    expect(materials).toEqual([]);
    expect(typeof fireLevel).toBe("number");
  });

  it("button shows 开炉中... and is disabled while alchemyLoading=true", () => {
    useGameStore.setState({ alchemyModalOpen: true, alchemyLoading: true });

    render(<AlchemyModal />);
    const button = screen.getByRole("button", { name: "开炉中..." }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("shows lastAlchemyResult inside the dialog and switches button to 再炼一炉", () => {
    useGameStore.setState({
      alchemyModalOpen: true,
      lastAlchemyResult: "丹成，可以入喉。（普通 / 产物 遮云丹）",
      alchemyResultTick: 1
    });

    render(<AlchemyModal />);
    expect(screen.getByTestId("alchemy-result").textContent).toContain("产物 遮云丹");
    expect(screen.getByRole("button", { name: "再炼一炉" })).toBeTruthy();
  });

  it("remounts the result node when alchemyResultTick advances", () => {
    useGameStore.setState({
      alchemyModalOpen: true,
      lastAlchemyResult: "丹成，可以入喉。",
      alchemyResultTick: 1
    });

    const { rerender } = render(<AlchemyModal />);
    const first = screen.getByTestId("alchemy-result");

    useGameStore.setState({ lastAlchemyResult: "丹成，可以入喉。", alchemyResultTick: 2 });
    rerender(<AlchemyModal />);
    const second = screen.getByTestId("alchemy-result");

    expect(second).not.toBe(first);
  });
});
