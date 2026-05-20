import { beforeEach, describe, expect, it } from "vitest";
import { addMemory, clearMemories, getRecentMemories, retrieveRelevantMemories } from "../services/memoryStore.js";

describe("memoryStore", () => {
  beforeEach(() => {
    clearMemories("baili");
  });

  it("does not store empty memories", async () => {
    await addMemory("baili", "");
    await addMemory("baili", "   ");

    expect(getRecentMemories("baili")).toEqual([]);
  });

  it("stores memories in insertion order and returns the recent limit", async () => {
    for (let index = 1; index <= 8; index += 1) {
      await addMemory("baili", `memory-${index}`);
    }

    expect(getRecentMemories("baili", 5)).toEqual(["memory-4", "memory-5", "memory-6", "memory-7", "memory-8"]);
  });

  it("keeps at most 100 memories per NPC", async () => {
    for (let index = 1; index <= 120; index += 1) {
      await addMemory("baili", `memory-${index}`);
    }

    const all = getRecentMemories("baili", 200);
    expect(all).toHaveLength(100);
    expect(all[0]).toBe("memory-21");
    expect(all[99]).toBe("memory-120");
  });

  it("retrieves relevant memories ordered by cosine similarity", async () => {
    await addMemory("baili", "玩家想买屏蔽天道云的丹药");
    await addMemory("baili", "玩家提到雷罚帮赤目");
    await addMemory("baili", "玩家送来一份蘑菇");
    await addMemory("baili", "玩家又问起屏蔽天道云");

    const results = await retrieveRelevantMemories("baili", "天道云屏蔽丹药", 2);

    expect(results).toHaveLength(2);
    expect(results[0].content).toContain("屏蔽天道云");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("returns empty array when query is blank or k=0", async () => {
    await addMemory("baili", "玩家做了一件事");
    expect(await retrieveRelevantMemories("baili", "", 5)).toEqual([]);
    expect(await retrieveRelevantMemories("baili", "事", 0)).toEqual([]);
  });
});
