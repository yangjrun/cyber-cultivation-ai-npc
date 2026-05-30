import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { clearSessionsForTests, getPlayer, updatePlayer } from "../services/playerStore.js";
import { resetGameState } from "../services/gameState.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";
import { addItem } from "../services/inventoryStore.js";
import { getDb } from "../db/connection.js";

async function createTestSession(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app).post("/api/session").expect(201);
  return res.body.sessionId;
}

describe("economy routes", () => {
  beforeEach(() => {
    clearSessionsForTests();
    resetGameState();
    clearAllMemoriesForTests();
  });

  describe("POST /api/economy/passive-income/claim", () => {
    it("does not pay 练气期 players", async () => {
      const app = createApp();
      const sessionId = await createTestSession(app);

      const res = await request(app)
        .post("/api/economy/passive-income/claim")
        .send({ sessionId })
        .expect(200);

      expect(res.body.claimed).toBe(false);
      expect(res.body.amount).toBe(0);
      expect(res.body.message).toContain("练气期");
    });

    it("sets an anchor on first claim for 筑基期 without paying", async () => {
      const app = createApp();
      const sessionId = await createTestSession(app);
      updatePlayer(sessionId, { cultivationStageIdx: 9 }); // 筑基初期

      const res = await request(app)
        .post("/api/economy/passive-income/claim")
        .send({ sessionId })
        .expect(200);

      expect(res.body.claimed).toBe(false);
      expect(res.body.amount).toBe(0);
      expect(res.body.player.passiveIncomeClaimedAt).toBeTruthy();
    });

    it("pays accrued income after the anchor is backdated", async () => {
      const app = createApp();
      const sessionId = await createTestSession(app);
      updatePlayer(sessionId, { cultivationStageIdx: 12 }); // 金丹初期 = 20/day

      const before = getPlayer(sessionId)!.spiritStones;

      // Backdate the claim anchor by 3 days
      const pastTime = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      getDb()
        .prepare("UPDATE players SET passive_income_claimed_at = ? WHERE session_id = ?")
        .run(pastTime, sessionId);

      const res = await request(app)
        .post("/api/economy/passive-income/claim")
        .send({ sessionId })
        .expect(200);

      expect(res.body.claimed).toBe(true);
      expect(res.body.daysAccrued).toBe(3);
      expect(res.body.amount).toBe(60); // 3 * 20
      expect(res.body.player.spiritStones).toBe(before + 60);
    });

    it("returns 404 for unknown session", async () => {
      const app = createApp();
      await request(app)
        .post("/api/economy/passive-income/claim")
        .send({ sessionId: "00000000-0000-0000-0000-000000000000" })
        .expect(404);
    });

    it("rejects malformed sessionId", async () => {
      const app = createApp();
      await request(app)
        .post("/api/economy/passive-income/claim")
        .send({ sessionId: "not-a-uuid" })
        .expect(400);
    });
  });

  describe("GET /api/economy/:sessionId/stats", () => {
    it("returns an economy snapshot for a fresh session", async () => {
      const app = createApp();
      const sessionId = await createTestSession(app);

      const res = await request(app).get(`/api/economy/${sessionId}/stats`).expect(200);

      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.spiritStones).toBe(0);
      expect(res.body.stats.cultivationStageIdx).toBe(0);
      // starter inventory has items
      expect(res.body.stats.inventoryItemCount).toBeGreaterThan(0);
      expect(res.body.stats.alchemy.totalAttempts).toBe(0);
      expect(res.body.stats.quests).toEqual({ completed: 0, failed: 0, active: 0 });
    });

    it("reflects alchemy attempts in the snapshot", async () => {
      const app = createApp();
      const sessionId = await createTestSession(app);

      // Ensure enough materials for 3 refines (each cloud_veil_pill needs shadow_herb x2 + ash_salt x1)
      addItem(sessionId, "shadow_herb", 6);
      addItem(sessionId, "ash_salt", 3);

      // Perform a few alchemy refines
      for (let i = 0; i < 3; i += 1) {
        await request(app)
          .post("/api/alchemy/refine")
          .send({ sessionId, recipeId: "cloud_veil_pill", fireLevel: 62 });
      }

      const res = await request(app).get(`/api/economy/${sessionId}/stats`).expect(200);
      expect(res.body.stats.alchemy.totalAttempts).toBe(3);
      const breakdown = res.body.stats.alchemy.qualityBreakdown;
      const sum = breakdown.failed + breakdown.common + breakdown.fine + breakdown.perfect;
      expect(sum).toBe(3);
    });

    it("returns 404 for unknown session", async () => {
      const app = createApp();
      await request(app)
        .get("/api/economy/00000000-0000-0000-0000-000000000000/stats")
        .expect(404);
    });
  });
});
