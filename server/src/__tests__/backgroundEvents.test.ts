import { beforeEach, describe, expect, it } from "vitest";
import { clearBackgroundEventsForTests, generateDueBackgroundEvents, markPlayerEnteredScene, markPlayerLeftScene } from "../services/backgroundEvents.js";
import { clearInventoryForTests } from "../services/inventoryStore.js";
import { clearAllMemoriesForTests, getRecentMemories } from "../services/memoryStore.js";
import { clearRelationsForTests, getRelation } from "../services/npcRelationsStore.js";
import { clearSessionsForTests, createSession } from "../services/playerStore.js";
import { resetGameState } from "../services/gameState.js";

const START = new Date("2026-05-21T00:00:00.000Z");
const AFTER_29_MIN = new Date("2026-05-21T00:29:00.000Z");
const AFTER_30_MIN = new Date("2026-05-21T00:30:00.000Z");

describe("backgroundEvents", () => {
  beforeEach(() => {
    clearBackgroundEventsForTests();
    clearRelationsForTests();
    clearAllMemoriesForTests();
    clearInventoryForTests();
    clearSessionsForTests();
    resetGameState();
  });

  it("does not generate while player is present", async () => {
    const session = createSession();
    markPlayerEnteredScene({ sessionId: session.sessionId, sceneId: "thunder_tavern", now: START });

    await expect(generateDueBackgroundEvents({
      sessionId: session.sessionId,
      sceneId: "thunder_tavern",
      now: AFTER_30_MIN
    })).resolves.toEqual({ generated: false, reason: "present" });
  });

  it("waits until player has been absent for 30 minutes", async () => {
    const session = createSession();
    markPlayerLeftScene({ sessionId: session.sessionId, sceneId: "thunder_tavern", now: START });

    await expect(generateDueBackgroundEvents({
      sessionId: session.sessionId,
      sceneId: "thunder_tavern",
      now: AFTER_29_MIN
    })).resolves.toEqual({ generated: false, reason: "not_due" });
  });

  it("generates a deterministic NPC event and writes relation plus memory effects", async () => {
    const session = createSession();
    markPlayerLeftScene({ sessionId: session.sessionId, sceneId: "thunder_tavern", now: START });

    const result = await generateDueBackgroundEvents({
      sessionId: session.sessionId,
      sceneId: "thunder_tavern",
      now: AFTER_30_MIN
    });

    expect(result).toEqual({
      generated: true,
      event: expect.objectContaining({
        sceneId: "thunder_tavern",
        fromNpc: "chimu",
        toNpc: "qinggu",
        generatedAt: AFTER_30_MIN.toISOString()
      })
    });
    expect(getRelation(session.sessionId, "chimu", "qinggu")).toMatchObject({ trust: 6, hostility: 0 });
    expect(getRelation(session.sessionId, "qinggu", "chimu")).toMatchObject({ trust: 11, hostility: 0 });
    expect(getRecentMemories(`${session.sessionId}::chimu`, 1)[0]).toContain("趁玩家离开交换了消息");
    expect(getRecentMemories(`${session.sessionId}::qinggu`, 1)[0]).toContain("趁玩家离开交换了消息");
  });

  it("enforces daily cap", async () => {
    const session = createSession();
    let now = START;
    markPlayerLeftScene({ sessionId: session.sessionId, sceneId: "thunder_tavern", now });

    for (let i = 1; i <= 3; i += 1) {
      now = new Date(START.getTime() + i * 30 * 60 * 1000);
      const result = await generateDueBackgroundEvents({ sessionId: session.sessionId, sceneId: "thunder_tavern", now });
      expect(result.generated).toBe(true);
    }

    now = new Date(START.getTime() + 4 * 30 * 60 * 1000);
    await expect(generateDueBackgroundEvents({
      sessionId: session.sessionId,
      sceneId: "thunder_tavern",
      now
    })).resolves.toEqual({ generated: false, reason: "daily_cap" });
  });
});
