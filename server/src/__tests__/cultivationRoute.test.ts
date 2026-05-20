import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { clearSessionsForTests, updatePlayer } from "../services/playerStore.js";
import { resetGameState, applyStateDelta } from "../services/gameState.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";

describe("cultivation routes", () => {
  beforeEach(() => {
    clearSessionsForTests();
    resetGameState();
    clearAllMemoriesForTests();
  });

  it("cultivates qi for the current session", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    const response = await request(app)
      .post("/api/cultivate")
      .send({ sessionId, duration: 30 })
      .expect(200);

    expect(response.body.qiGained).toBeGreaterThan(0);
    expect(response.body.player.sessionId).toBe(sessionId);
    expect(response.body.player.qiCurrent).toBe(response.body.qiGained);
  });

  it("rejects breakthrough before qi is full", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    const response = await request(app)
      .post("/api/breakthrough")
      .send({ sessionId })
      .expect(200);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("灵气未满");
  });

  it("returns high-risk failure under high tianDaoAlert", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);
    updatePlayer(sessionId, { qiCurrent: 100 });
    applyStateDelta(`${sessionId}::baili`, { trust: 0, fear: 0, anger: 0, tianDaoAlert: 55 });

    const response = await request(app)
      .post("/api/breakthrough")
      .send({ sessionId })
      .expect(200);

    expect(response.body.riskLevel).toBe("high");
    expect(response.body.npcState.tianDaoAlert).toBeGreaterThanOrEqual(70);
  });
});

async function createTestSession(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await request(app).post("/api/session").send({}).expect(201);
  return response.body.sessionId as string;
}
