import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { clearSessionsForTests, updatePlayer } from "../services/playerStore.js";
import { resetGameState, applyStateDelta } from "../services/gameState.js";
import { scopedNpcId } from "../services/scopedNpcId.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";
import { getDb } from "../db/connection.js";

describe("trade routes", () => {
  beforeEach(() => {
    clearSessionsForTests();
    resetGameState();
    clearAllMemoriesForTests();
  });

  it("returns a shop snapshot with buy prices and sell quotes", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    const response = await request(app).get(`/api/trade/${sessionId}/baili`).expect(200);

    expect(response.body.shop.npcId).toBe("baili");
    expect(response.body.shop.npcSpiritStones).toBe(800);
    expect(response.body.shop.refused).toBe(false);
    expect(response.body.shop.items.length).toBeGreaterThan(0);
    expect(response.body.shop.items[0].buyUnitPrice).toBeGreaterThanOrEqual(1);
    expect(response.body.shop.sellQuotes.length).toBeGreaterThan(0);
  });

  it("buys an item: stones drop, inventory grows, shop stock drops, npc stones rise", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);
    updatePlayer(sessionId, { spiritStones: 1000 });

    const before = await request(app).get(`/api/trade/${sessionId}/baili`).expect(200);
    const npcStonesBefore = before.body.shop.npcSpiritStones;

    const response = await request(app)
      .post("/api/trade/buy")
      .send({ sessionId, npcId: "baili", itemId: "cheap_qi_pill", quantity: 1 })
      .expect(200);

    expect(response.body.player.spiritStones).toBe(1000 - response.body.totalPrice);
    expect(response.body.npcState.trust).toBeGreaterThanOrEqual(1);
    expect(response.body.shop.npcSpiritStones).toBe(npcStonesBefore + response.body.totalPrice);

    const pill = response.body.inventory.find((entry: { itemId: string }) => entry.itemId === "cheap_qi_pill");
    expect(pill.quantity).toBe(2); // starter 1 + bought 1
  });

  it("rejects buying more than shop stock", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);
    updatePlayer(sessionId, { spiritStones: 100000 });

    const response = await request(app)
      .post("/api/trade/buy")
      .send({ sessionId, npcId: "baili", itemId: "breakthrough_pill", quantity: 5 })
      .expect(400);

    expect(response.body.error).toContain("存货不足");
  });

  it("rejects buying without enough spirit stones", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    const response = await request(app)
      .post("/api/trade/buy")
      .send({ sessionId, npcId: "baili", itemId: "cheap_qi_pill", quantity: 1 })
      .expect(400);

    expect(response.body.error).toContain("灵石不足");
  });

  it("sells a starter item for spirit stones", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    const response = await request(app)
      .post("/api/trade/sell")
      .send({ sessionId, npcId: "baili", itemId: "shadow_herb", quantity: 1 })
      .expect(200);

    expect(response.body.player.spiritStones).toBe(response.body.totalPrice);
    expect(response.body.totalPrice).toBeGreaterThanOrEqual(1);

    const herb = response.body.inventory.find((entry: { itemId: string }) => entry.itemId === "shadow_herb");
    expect(herb.quantity).toBe(2); // starter 3 - sold 1
  });

  it("rejects selling more than the player owns", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    const response = await request(app)
      .post("/api/trade/sell")
      .send({ sessionId, npcId: "baili", itemId: "shadow_herb", quantity: 99 })
      .expect(400);

    expect(response.body.error).toContain("物品不足");
  });

  it("refuses all trade when npc anger is maxed", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);
    applyStateDelta(scopedNpcId(sessionId, "baili"), { trust: 0, fear: 0, anger: 90, tianDaoAlert: 0 });
    updatePlayer(sessionId, { spiritStones: 1000 });

    const response = await request(app)
      .post("/api/trade/buy")
      .send({ sessionId, npcId: "baili", itemId: "cheap_qi_pill", quantity: 1 })
      .expect(409);

    expect(response.body.error).toBeTruthy();
  });

  it("regenerates shop balance after 24 hours", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);
    updatePlayer(sessionId, { spiritStones: 10000 });

    // Drain baili's balance by selling many items
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post("/api/trade/sell")
        .send({ sessionId, npcId: "baili", itemId: "shadow_herb", quantity: 1 })
        .expect(200);
    }

    const drained = await request(app).get(`/api/trade/${sessionId}/baili`).expect(200);
    const drainedBalance = drained.body.shop.npcSpiritStones;
    expect(drainedBalance).toBeLessThan(800);

    // Simulate 24 hours passing by backdating the regeneration record
    const db = getDb();
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    db.prepare(
      `INSERT OR REPLACE INTO shop_balance_regeneration (session_id, npc_id, last_regenerated_at)
       VALUES (?, ?, ?)`
    ).run(sessionId, "baili", yesterday);

    // Next query should trigger regeneration
    const regenerated = await request(app).get(`/api/trade/${sessionId}/baili`).expect(200);
    expect(regenerated.body.shop.npcSpiritStones).toBe(800);
  });

  it("does not regenerate shop balance before 24 hours", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);
    updatePlayer(sessionId, { spiritStones: 10000 });

    // Drain balance
    await request(app)
      .post("/api/trade/sell")
      .send({ sessionId, npcId: "baili", itemId: "shadow_herb", quantity: 1 })
      .expect(200);

    const drained = await request(app).get(`/api/trade/${sessionId}/baili`).expect(200);
    const drainedBalance = drained.body.shop.npcSpiritStones;

    // Query again immediately (within 24 hours)
    const stillDrained = await request(app).get(`/api/trade/${sessionId}/baili`).expect(200);
    expect(stillDrained.body.shop.npcSpiritStones).toBe(drainedBalance);
  });

  it("preserves higher balance when regenerating (only tops up)", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);
    updatePlayer(sessionId, { spiritStones: 10000 });

    // Buy items to increase NPC balance above seed
    await request(app)
      .post("/api/trade/buy")
      .send({ sessionId, npcId: "baili", itemId: "cheap_qi_pill", quantity: 3 })
      .expect(200);

    const enriched = await request(app).get(`/api/trade/${sessionId}/baili`).expect(200);
    const enrichedBalance = enriched.body.shop.npcSpiritStones;
    expect(enrichedBalance).toBeGreaterThan(800);

    // Simulate 24 hours passing
    const db = getDb();
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    db.prepare(
      `INSERT OR REPLACE INTO shop_balance_regeneration (session_id, npc_id, last_regenerated_at)
       VALUES (?, ?, ?)`
    ).run(sessionId, "baili", yesterday);

    // Regeneration should preserve the higher balance
    const afterRegen = await request(app).get(`/api/trade/${sessionId}/baili`).expect(200);
    expect(afterRegen.body.shop.npcSpiritStones).toBe(enrichedBalance);
  });
});

async function createTestSession(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await request(app).post("/api/session").send({}).expect(201);
  return response.body.sessionId as string;
}
