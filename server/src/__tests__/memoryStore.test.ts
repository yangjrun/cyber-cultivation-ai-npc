import { beforeEach, describe, expect, it } from "vitest";
import { addMemory, clearMemories, getRecentMemories } from "../services/memoryStore.js";

describe("memoryStore", () => {
  beforeEach(() => {
    clearMemories("baili");
  });

  it("does not store empty memories", () => {
    addMemory("baili", "");
    addMemory("baili", "   ");

    expect(getRecentMemories("baili")).toEqual([]);
  });

  it("stores memories in insertion order and returns the recent limit", () => {
    for (let index = 1; index <= 8; index += 1) {
      addMemory("baili", `memory-${index}`);
    }

    expect(getRecentMemories("baili", 5)).toEqual(["memory-4", "memory-5", "memory-6", "memory-7", "memory-8"]);
  });

  it("keeps at most 20 memories per NPC", () => {
    for (let index = 1; index <= 25; index += 1) {
      addMemory("baili", `memory-${index}`);
    }

    expect(getRecentMemories("baili", 25)).toHaveLength(20);
    expect(getRecentMemories("baili", 25)[0]).toBe("memory-6");
    expect(getRecentMemories("baili", 25)[19]).toBe("memory-25");
  });
});
