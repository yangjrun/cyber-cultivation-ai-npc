import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryPanel } from "./InventoryPanel";
import { resetGameStoreForTests, useGameStore } from "../state/store";
import type { InventoryItem } from "../api/sessionApi";

const pill = (itemId: string, name: string, qty: number): InventoryItem => ({
  itemId,
  quantity: qty,
  item: {
    id: itemId,
    name,
    type: "pill",
    description: "测试丹药",
    effect: { type: "restore_qi", amount: 10 }
  }
});

const material = (itemId: string, name: string, qty: number): InventoryItem => ({
  itemId,
  quantity: qty,
  item: {
    id: itemId,
    name,
    type: "material",
    description: "炼丹原料"
  }
});

describe("InventoryPanel", () => {
  beforeEach(() => {
    resetGameStoreForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows placeholder when inventory is empty", () => {
    render(<InventoryPanel />);
    expect(screen.getByText("背包空空，连丹渣都没有。")).toBeTruthy();
  });

  it("renders each item's name, description and ×quantity", () => {
    useGameStore.setState({
      inventory: [pill("cloud_veil_pill", "遮云丹", 2), material("yinglui", "影髓草", 5)]
    });

    render(<InventoryPanel />);
    expect(screen.getByText("遮云丹")).toBeTruthy();
    expect(screen.getByText("影髓草")).toBeTruthy();
    expect(screen.getByText("×2")).toBeTruthy();
    expect(screen.getByText("×5")).toBeTruthy();
  });

  it("renders 使用 button only for pills, not for materials", () => {
    useGameStore.setState({
      inventory: [pill("cloud_veil_pill", "遮云丹", 1), material("yinglui", "影髓草", 1)]
    });

    render(<InventoryPanel />);
    const useButtons = screen.getAllByRole("button", { name: "使用" });
    expect(useButtons).toHaveLength(1);
  });

  it("clicking 使用 fires consumeItem with the itemId", async () => {
    const consumeSpy = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({
      inventory: [pill("cloud_veil_pill", "遮云丹", 1)],
      consumeItem: consumeSpy
    });

    render(<InventoryPanel />);
    await userEvent.click(screen.getByRole("button", { name: "使用" }));
    expect(consumeSpy).toHaveBeenCalledWith("cloud_veil_pill");
  });

  it("clicking 炼丹 fires openAlchemyModal", async () => {
    const openSpy = vi.fn();
    useGameStore.setState({ openAlchemyModal: openSpy });

    render(<InventoryPanel />);
    await userEvent.click(screen.getByRole("button", { name: "炼丹" }));
    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});
