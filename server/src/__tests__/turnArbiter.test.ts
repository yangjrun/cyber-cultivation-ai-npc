import { beforeEach, describe, expect, it } from "vitest";
import { arbitrateTurn } from "../services/turnArbiter.js";
import { recordSpeakers, resetSpeakerLog, getLastSpokeTurns } from "../services/speakerLog.js";
import { sceneDefinitions } from "../data/scenes.js";
import type { SceneSnapshot } from "../types/scene.js";

function buildSnapshot(sceneId: keyof typeof sceneDefinitions): SceneSnapshot {
  return {
    scene: sceneDefinitions[sceneId],
    npcs: []
  };
}

describe("turnArbiter (mock mode)", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    resetSpeakerLog();
  });

  it("returns single speaker for default input in a single-NPC scene", async () => {
    const decision = await arbitrateTurn({
      targetNpcId: "baili",
      playerInput: "你好",
      scene: buildSnapshot("black_market"),
      npcStates: {},
      lastSpokeTurns: {}
    });

    expect(decision.speakers).toEqual([{ npcId: "baili", mode: "speak" }]);
    expect(decision.rationale).toEqual(expect.any(String));
  });

  it("returns two speakers when player input provokes a multi-NPC scene", async () => {
    const decision = await arbitrateTurn({
      targetNpcId: "chimu",
      playerInput: "让我过，顺便打听苏鹤是不是卧底",
      scene: buildSnapshot("thunder_tavern"),
      npcStates: {},
      lastSpokeTurns: {}
    });

    expect(decision.speakers).toHaveLength(2);
    expect(decision.speakers[0]).toEqual({ npcId: "chimu", mode: "speak" });
    expect(decision.speakers[1]).toEqual({ npcId: "qinggu", mode: "interrupt" });
  });

  it("returns empty speakers when player input contains a silence trigger", async () => {
    const decision = await arbitrateTurn({
      targetNpcId: "chimu",
      playerInput: "都给我滚",
      scene: buildSnapshot("thunder_tavern"),
      npcStates: {},
      lastSpokeTurns: {}
    });

    expect(decision.speakers).toEqual([]);
    expect(decision.rationale).toContain("沉默");
  });
});

describe("speakerLog", () => {
  beforeEach(() => {
    resetSpeakerLog();
  });

  it("tracks turns-since-last-spoke per NPC within a session", () => {
    recordSpeakers("session-1", ["chimu"]);
    recordSpeakers("session-1", ["qinggu"]);
    recordSpeakers("session-1", ["chimu", "qinggu"]);

    const distances = getLastSpokeTurns("session-1");
    expect(distances.chimu).toBe(0);
    expect(distances.qinggu).toBe(0);
  });

  it("returns empty map for unseen sessions", () => {
    expect(getLastSpokeTurns("unknown")).toEqual({});
  });
});
