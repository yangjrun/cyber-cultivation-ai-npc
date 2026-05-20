import { beforeEach, describe, expect, it } from "vitest";
import { listNpcIds, npcProfiles } from "../data/npcs.js";
import { listScenes } from "../data/scenes.js";
import { clearSessionsForTests, createSession } from "../services/playerStore.js";
import { getActiveSceneId, getAllScenes, getNpcsInScene, getSceneById, getSceneSnapshot, setActiveSceneId } from "../services/sceneStore.js";

describe("sceneStore", () => {
  beforeEach(() => {
    clearSessionsForTests();
  });

  it("exposes all 4 scenes via getAllScenes", () => {
    const scenes = getAllScenes();
    expect(scenes.map((scene) => scene.sceneId).sort()).toEqual(["black_market", "inspector_outpost", "player_cave", "thunder_tavern"]);
  });

  it("scene npcIds all resolve to known NPC profiles", () => {
    const knownNpcs = new Set(listNpcIds());

    for (const scene of listScenes()) {
      for (const npcId of scene.npcIds) {
        expect(knownNpcs.has(npcId)).toBe(true);
      }
    }
  });

  it("returns null for unknown scene", () => {
    expect(getSceneById("nonexistent")).toBeNull();
  });

  it("getNpcsInScene returns a fresh copy", () => {
    const a = getNpcsInScene("thunder_tavern");
    a.push("mutated");
    expect(getNpcsInScene("thunder_tavern")).not.toContain("mutated");
  });

  it("persists active scene per session and defaults to black_market", () => {
    const session = createSession();

    expect(getActiveSceneId(session.sessionId)).toBe("black_market");

    setActiveSceneId(session.sessionId, "thunder_tavern");
    expect(getActiveSceneId(session.sessionId)).toBe("thunder_tavern");
  });

  it("setActiveSceneId rejects unknown scene", () => {
    const session = createSession();
    expect(() => setActiveSceneId(session.sessionId, "fake_scene")).toThrow(/Unknown scene/);
  });

  it("getSceneSnapshot composes scene + npc profiles + npc states", () => {
    const session = createSession();
    const snapshot = getSceneSnapshot(session.sessionId, "thunder_tavern");

    expect(snapshot).not.toBeNull();
    if (!snapshot) {
      return;
    }

    expect(snapshot.scene.sceneId).toBe("thunder_tavern");
    expect(snapshot.npcs.map((n) => n.profile.npc_id).sort()).toEqual(["chimu", "qinggu"]);
    expect(snapshot.npcs[0].state).toMatchObject(npcProfiles[snapshot.npcs[0].profile.npc_id].initialState);
  });
});
