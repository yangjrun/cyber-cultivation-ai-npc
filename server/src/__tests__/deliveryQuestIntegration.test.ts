import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../index.js";
import { resetGameState } from "../services/gameState.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";
import { clearRelationsForTests } from "../services/npcRelationsStore.js";
import { clearSessionsForTests } from "../services/playerStore.js";
import { clearQuestProgressForTests } from "../services/questStore.js";
import { clearInventoryForTests } from "../services/inventoryStore.js";

describe("delivery quest integration", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    // Force mock mode for consistent testing
    delete process.env.LLM_API_KEY;
    clearQuestProgressForTests();
    clearRelationsForTests();
    clearAllMemoriesForTests();
    clearInventoryForTests();
    clearSessionsForTests();
    resetGameState();
    app = createApp();
  });

  it("completes baili_delivery_run quest end-to-end", async () => {
    // Step 1: Create session
    const sessionRes = await request(app)
      .post("/api/session")
      .send({ name: "测试玩家" })
      .expect(201);

    const sessionId = sessionRes.body.sessionId;
    expect(sessionId).toBeTruthy();

    // Step 2: Accept quest from Baili
    const acceptRes = await request(app)
      .post("/api/chat")
      .send({
        sessionId,
        npcId: "baili",
        playerInput: "有什么活",
        inputMode: "dialogue"
      })
      .expect(200);

    console.log("Accept response:", JSON.stringify(acceptRes.body, null, 2));
    expect(acceptRes.body.actionResult).toContain("接受任务");

    // Step 3: Check quest status - should be accepted
    const questsAfterAccept = await request(app)
      .get(`/api/quests/${sessionId}`)
      .expect(200);

    console.log("Quests after accept:", JSON.stringify(questsAfterAccept.body, null, 2));
    const questAfterAccept = questsAfterAccept.body.quests.find(
      (q: any) => q.questId === "baili_delivery_run"
    );
    expect(questAfterAccept?.status).toBe("accepted");

    // Step 4: Go to Chimu and deliver
    const deliverRes = await request(app)
      .post("/api/chat")
      .send({
        sessionId,
        npcId: "chimu",
        playerInput: "送货",
        inputMode: "dialogue"
      })
      .expect(200);

    console.log("Deliver response:", JSON.stringify(deliverRes.body, null, 2));
    expect(deliverRes.body.actionResult).toContain("完成任务");

    // Step 5: Check quest status - should be completed
    const questsAfterDeliver = await request(app)
      .get(`/api/quests/${sessionId}`)
      .expect(200);

    console.log("Quests after deliver:", JSON.stringify(questsAfterDeliver.body, null, 2));
    const questAfterDeliver = questsAfterDeliver.body.quests.find(
      (q: any) => q.questId === "baili_delivery_run"
    );
    expect(questAfterDeliver?.status).toBe("completed");
    expect(questAfterDeliver?.progress?.delivery_done).toBe(true);

    // Step 6: Verify player received reward
    const playerRes = await request(app)
      .get(`/api/session/${sessionId}`)
      .expect(200);

    expect(playerRes.body.player.spiritStones).toBeGreaterThanOrEqual(35);
  });
});
