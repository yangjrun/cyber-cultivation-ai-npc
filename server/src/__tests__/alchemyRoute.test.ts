import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { clearSessionsForTests } from "../services/playerStore.js";
import { resetGameState } from "../services/gameState.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";

describe("alchemy and inventory routes", () => {
  beforeEach(() => {
    clearSessionsForTests();
    resetGameState();
    clearAllMemoriesForTests();
  });

  it("refines a pill from starter materials", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    const response = await request(app)
      .post("/api/alchemy/refine")
      .send({ sessionId, recipeId: "cloud_veil_pill", materials: [], fireLevel: 62 })
      .expect(200);

    expect(response.body.resultItem.id).toMatch(/cloud_veil_pill|failed_dregs/);
    expect(response.body.inventory).toEqual(expect.any(Array));
  });

  it("uses cloud veil pill to reduce tianDaoAlert", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    await request(app)
      .post("/api/alchemy/refine")
      .send({ sessionId, recipeId: "cloud_veil_pill", materials: [], fireLevel: 62 })
      .expect(200);

    const response = await request(app)
      .post("/api/inventory/use")
      .send({ sessionId, itemId: "cloud_veil_pill" })
      .expect(200);

    expect(response.body.npcState.tianDaoAlert).toBeLessThan(45);
    expect(response.body.message).toContain("天道警戒下降");
  });
});

async function createTestSession(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await request(app).post("/api/session").send({}).expect(201);
  return response.body.sessionId as string;
}
