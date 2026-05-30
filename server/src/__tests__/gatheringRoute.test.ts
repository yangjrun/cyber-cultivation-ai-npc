import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { clearSessionsForTests, updatePlayer } from "../services/playerStore.js";
import { resetGameState, getNpcState } from "../services/gameState.js";
import { scopedNpcId } from "../services/scopedNpcId.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";
import { setGatheringCooldown } from "../services/gatheringStore.js";

async function createTestSession(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app).post("/api/session").expect(201);
  return res.body.sessionId;
}

describe("gathering routes", () => {
  beforeEach(() => {
    clearSessionsForTests();
    resetGameState();
    clearAllMemoriesForTests();
  });

  it("lists gathering points for a scene with availability", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    const res = await request(app).get(`/api/gathering/${sessionId}/black_market`).expect(200);

    expect(Array.isArray(res.body.points)).toBe(true);
    expect(res.body.points.length).toBeGreaterThan(0);
    const point = res.body.points[0];
    expect(point.pointId).toBeTruthy();
    expect(point.name).toBeTruthy();
    expect(point.qiCost).toBeGreaterThan(0);
    expect(point.available).toBe(true);
  });

  it("returns empty list for scene with no gathering points", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    const res = await request(app).get(`/api/gathering/${sessionId}/nonexistent_scene`).expect(200);

    expect(res.body.points).toEqual([]);
  });

  it("gathers items: qi drops, inventory grows, cooldown set", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    // Give player full qi
    updatePlayer(sessionId, { qiCurrent: 100, qiCap: 100 });

    const res = await request(app)
      .post("/api/gathering/gather")
      .send({ sessionId, pointId: "black_market_herbs" })
      .expect(200);

    // qi should be consumed
    expect(res.body.player.qiCurrent).toBe(100 - res.body.qiCost);
    expect(res.body.qiCost).toBe(10); // black_market_herbs qiCost

    if (res.body.success) {
      expect(res.body.itemsGained.length).toBeGreaterThan(0);
      expect(res.body.nextAvailableAt).toBeTruthy();
    }
  });

  it("rejects gathering when qi is insufficient", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    // Set qi too low
    updatePlayer(sessionId, { qiCurrent: 5, qiCap: 100 });

    const res = await request(app)
      .post("/api/gathering/gather")
      .send({ sessionId, pointId: "black_market_herbs" })
      .expect(400);

    expect(res.body.error).toContain("灵气不足");
  });

  it("rejects gathering when point is on cooldown", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);
    updatePlayer(sessionId, { qiCurrent: 100, qiCap: 100 });

    // Set a future cooldown
    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    setGatheringCooldown(sessionId, "black_market_herbs", futureTime);

    const res = await request(app)
      .post("/api/gathering/gather")
      .send({ sessionId, pointId: "black_market_herbs" })
      .expect(409);

    expect(res.body.error).toContain("冷却");
  });

  it("raises tianDaoAlert for high-risk gathering points", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);
    updatePlayer(sessionId, { qiCurrent: 100, qiCap: 100 });

    const alertBefore = getNpcState(scopedNpcId(sessionId, "suhe")).tianDaoAlert;

    // inspector_ruins has alertRisk: 5, scene inspector_outpost has suhe
    await request(app)
      .post("/api/gathering/gather")
      .send({ sessionId, pointId: "inspector_ruins" })
      .expect(200);

    const alertAfter = getNpcState(scopedNpcId(sessionId, "suhe")).tianDaoAlert;
    expect(alertAfter).toBe(alertBefore + 5);
  });

  it("rejects invalid pointId", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    const res = await request(app)
      .post("/api/gathering/gather")
      .send({ sessionId, pointId: "fake_point" })
      .expect(400);

    expect(res.body.error).toBeTruthy();
  });

  it("returns 404 for unknown session", async () => {
    const app = createApp();

    await request(app)
      .post("/api/gathering/gather")
      .send({ sessionId: "00000000-0000-0000-0000-000000000000", pointId: "black_market_herbs" })
      .expect(404);
  });

  it("marks point as unavailable after gathering", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);
    updatePlayer(sessionId, { qiCurrent: 100, qiCap: 100 });

    await request(app)
      .post("/api/gathering/gather")
      .send({ sessionId, pointId: "black_market_herbs" })
      .expect(200);

    const listRes = await request(app).get(`/api/gathering/${sessionId}/black_market`).expect(200);
    const point = listRes.body.points.find((p: { pointId: string }) => p.pointId === "black_market_herbs");

    expect(point.available).toBe(false);
    expect(point.nextAvailableAt).toBeTruthy();
  });
});
