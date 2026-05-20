import { describe, expect, it, beforeEach } from "vitest";
import {
  getActiveMemories,
  getActiveMessages,
  getActiveNpcState,
  getNpcName,
  initialNpcState,
  resetGameStoreForTests,
  useGameStore
} from "./store";
import type { ChatMessage } from "../components/DialoguePanel";

describe("game store helpers", () => {
  beforeEach(() => {
    resetGameStoreForTests();
  });

  it("getNpcName returns Chinese name for known NPC, fallback for unknown", () => {
    expect(getNpcName("baili")).toBe("白璃");
    expect(getNpcName("suhe")).toBe("苏鹤");
    expect(getNpcName("chimu")).toBe("赤目");
    expect(getNpcName("qinggu")).toBe("青姑");
    expect(getNpcName("unknown")).toBe("unknown");
  });

  it("getActiveMessages returns the per-NPC list and stable empty array fallback", () => {
    const state = useGameStore.getState();
    expect(getActiveMessages(state)).toEqual([]);

    const sample: ChatMessage = {
      id: "m1",
      speaker: "npc",
      name: "白璃",
      text: "嗯。",
      timestamp: "00:01"
    };

    useGameStore.setState({
      activeNpcId: "baili",
      messagesByNpc: { baili: [sample] }
    });

    expect(getActiveMessages(useGameStore.getState())).toEqual([sample]);
  });

  it("getActiveNpcState falls back to initialNpcState when absent", () => {
    const state = useGameStore.getState();
    expect(getActiveNpcState(state)).toEqual(initialNpcState);
  });

  it("getActiveMemories returns the per-NPC memories", () => {
    useGameStore.setState({
      activeNpcId: "suhe",
      memoriesByNpc: { suhe: ["第一次见面"] }
    });

    expect(getActiveMemories(useGameStore.getState())).toEqual(["第一次见面"]);
  });

  it("selectNpc switches activeNpcId without clearing messages", () => {
    const baseMessage: ChatMessage = {
      id: "m1",
      speaker: "npc",
      name: "白璃",
      text: "嗯。",
      timestamp: "00:01"
    };

    useGameStore.setState({
      activeNpcId: "baili",
      messagesByNpc: { baili: [baseMessage] },
      memoriesByNpc: { baili: ["旧客来过"] }
    });

    useGameStore.getState().selectNpc("suhe");

    const state = useGameStore.getState();
    expect(state.activeNpcId).toBe("suhe");
    expect(state.messagesByNpc.baili).toEqual([baseMessage]);
    expect(getActiveMessages(state)).toEqual([]);
  });
});
