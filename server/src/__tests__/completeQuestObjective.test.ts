import { beforeEach, describe, expect, it } from "vitest";
import { resetGameState } from "../services/gameState.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";
import { clearRelationsForTests } from "../services/npcRelationsStore.js";
import { clearSessionsForTests, createSession, getPlayer } from "../services/playerStore.js";
import { evaluateIntent } from "../services/questEngine.js";
import { clearQuestProgressForTests, getQuestProgress } from "../services/questStore.js";
import { scopedNpcId } from "../services/scopedNpcId.js";
import { clearInventoryForTests } from "../services/inventoryStore.js";

describe("complete_quest_objective intent", () => {
  beforeEach(() => {
    clearQuestProgressForTests();
    clearRelationsForTests();
    clearAllMemoriesForTests();
    clearInventoryForTests();
    clearSessionsForTests();
    resetGameState();
  });

  it("completes baili_delivery_run when chimu receives delivery", () => {
    const session = createSession();
    const sessionId = session.sessionId;
    const bailiScoped = scopedNpcId(sessionId, "baili");
    const chimuScoped = scopedNpcId(sessionId, "chimu");

    // Step 1: Accept quest from Baili
    const acceptResult = evaluateIntent(sessionId, bailiScoped, {
      type: "give_quest",
      params: { quest_id: "baili_delivery_run" }
    });

    console.log("After accept:", acceptResult);
    let progress = getQuestProgress(sessionId, "baili_delivery_run");
    console.log("Progress after accept:", progress);
    expect(progress?.status).toBe("accepted");

    // Step 2: Player goes to Chimu and delivers
    const deliveryResult = evaluateIntent(sessionId, chimuScoped, {
      type: "complete_quest_objective",
      params: {
        quest_id: "baili_delivery_run",
        flag_key: "delivery_done"
      }
    });

    console.log("After delivery:", deliveryResult);
    progress = getQuestProgress(sessionId, "baili_delivery_run");
    console.log("Progress after delivery:", progress);

    // Should be completed now
    expect(progress?.status).toBe("completed");
    expect(progress?.progress.delivery_done).toBe(true);

    // Should have received reward
    const player = getPlayer(sessionId);
    expect(player?.spiritStones).toBeGreaterThanOrEqual(35);
  });

  it("handles multiple delivery attempts gracefully", () => {
    const session = createSession();
    const sessionId = session.sessionId;
    const bailiScoped = scopedNpcId(sessionId, "baili");
    const chimuScoped = scopedNpcId(sessionId, "chimu");

    // Accept quest
    evaluateIntent(sessionId, bailiScoped, {
      type: "give_quest",
      params: { quest_id: "baili_delivery_run" }
    });

    // First delivery attempt
    evaluateIntent(sessionId, chimuScoped, {
      type: "complete_quest_objective",
      params: {
        quest_id: "baili_delivery_run",
        flag_key: "delivery_done"
      }
    });

    let progress = getQuestProgress(sessionId, "baili_delivery_run");
    expect(progress?.status).toBe("completed");

    // Second delivery attempt (should not change anything)
    const secondResult = evaluateIntent(sessionId, chimuScoped, {
      type: "complete_quest_objective",
      params: {
        quest_id: "baili_delivery_run",
        flag_key: "delivery_done"
      }
    });

    expect(secondResult.statusChanges).toHaveLength(0);
    progress = getQuestProgress(sessionId, "baili_delivery_run");
    expect(progress?.status).toBe("completed");
  });
});
