import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NpcListPanel } from "./NpcListPanel";
import { resetGameStoreForTests, useGameStore } from "../state/store";

describe("NpcListPanel", () => {
  beforeEach(() => {
    resetGameStoreForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a placeholder when the active scene has no NPCs", () => {
    useGameStore.setState({
      activeSceneId: "empty_scene",
      scenes: [
        { sceneId: "empty_scene", name: "空场", description: "", backgroundAsset: "", npcIds: [], unlockedByDefault: true }
      ]
    });

    render(<NpcListPanel />);
    expect(screen.getByText("当前场景没有可对话的 NPC。")).toBeTruthy();
  });

  it("renders one button per NPC in the active scene with Chinese name + 信任/愤怒 badge", () => {
    useGameStore.setState({
      activeSceneId: "black_market",
      activeNpcId: "baili",
      scenes: [
        {
          sceneId: "black_market",
          name: "无相黑市",
          description: "",
          backgroundAsset: "",
          npcIds: ["baili", "suhe"],
          unlockedByDefault: true
        }
      ],
      npcStates: {
        baili: { trust: 20, fear: 0, anger: 0, tianDaoAlert: 0 },
        suhe: { trust: 0, fear: 0, anger: 30, tianDaoAlert: 0 }
      }
    });

    render(<NpcListPanel />);
    expect(screen.getByRole("button", { name: /白璃.*信20.*怒0/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /苏鹤.*信0.*怒30/ })).toBeTruthy();
  });

  it("marks the active NPC with aria-pressed=true", () => {
    useGameStore.setState({
      activeSceneId: "black_market",
      activeNpcId: "suhe",
      scenes: [
        {
          sceneId: "black_market",
          name: "无相黑市",
          description: "",
          backgroundAsset: "",
          npcIds: ["baili", "suhe"],
          unlockedByDefault: true
        }
      ],
      npcStates: {}
    });

    render(<NpcListPanel />);
    const baili = screen.getByRole("button", { name: /白璃/ });
    const suhe = screen.getByRole("button", { name: /苏鹤/ });
    expect(baili.getAttribute("aria-pressed")).toBe("false");
    expect(suhe.getAttribute("aria-pressed")).toBe("true");
  });

  it("clicking an NPC fires selectNpc and updates activeNpcId", async () => {
    useGameStore.setState({
      activeSceneId: "black_market",
      activeNpcId: "baili",
      scenes: [
        {
          sceneId: "black_market",
          name: "无相黑市",
          description: "",
          backgroundAsset: "",
          npcIds: ["baili", "suhe"],
          unlockedByDefault: true
        }
      ],
      npcStates: {}
    });

    render(<NpcListPanel />);
    await userEvent.click(screen.getByRole("button", { name: /苏鹤/ }));
    expect(useGameStore.getState().activeNpcId).toBe("suhe");
  });
});
