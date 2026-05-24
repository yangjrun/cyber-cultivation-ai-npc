import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import {
  buildEquippedPromptHints,
  buildEquippedTagList,
  clearEquippedArtifactsForTests,
  equipArtifact,
  evaluateArtifactUnlocks,
  getEquippedArtifactIds,
  getOwnedArtifacts,
  unequipArtifact
} from "../services/artifactEngine.js";
import { applyStateDelta, resetGameState } from "../services/gameState.js";
import { clearInventoryForTests } from "../services/inventoryStore.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";
import { clearRelationsForTests } from "../services/npcRelationsStore.js";
import { clearSessionsForTests, updatePlayer } from "../services/playerStore.js";
import { clearQuestProgressForTests } from "../services/questStore.js";
import { scopedNpcId } from "../services/scopedNpcId.js";
import {
  clearWorldStateForTests,
  evaluateMilestones
} from "../services/worldStateEngine.js";

async function createSession(): Promise<string> {
  const app = createApp();
  const res = await request(app).post("/api/session").send({}).expect(201);
  return res.body.sessionId as string;
}

describe("artifactEngine", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    process.env.NODE_ENV = "test";
    clearSessionsForTests();
    resetGameState();
    clearAllMemoriesForTests();
    clearInventoryForTests();
    clearQuestProgressForTests();
    clearRelationsForTests();
    clearWorldStateForTests();
    clearEquippedArtifactsForTests();
  });

  it("getOwnedArtifacts returns empty list for a fresh session", async () => {
    const sessionId = await createSession();
    expect(getOwnedArtifacts(sessionId)).toEqual([]);
  });

  it("evaluateArtifactUnlocks grants fentian_ling when baili trust >= 50", async () => {
    const sessionId = await createSession();
    applyStateDelta(scopedNpcId(sessionId, "baili"), { trust: 35, fear: 0, anger: 0, tianDaoAlert: 0 });
    // default baili.trust = 20, +35 = 55 → unlocks fentian_ling

    const result = evaluateArtifactUnlocks(sessionId);
    expect(result.newlyGranted).toContain("fentian_ling");

    const owned = getOwnedArtifacts(sessionId);
    expect(owned.map((o) => o.id)).toContain("fentian_ling");
    expect(owned.find((o) => o.id === "fentian_ling")?.equipped).toBe(false);
  });

  it("evaluateArtifactUnlocks is idempotent (does not grant twice)", async () => {
    const sessionId = await createSession();
    applyStateDelta(scopedNpcId(sessionId, "baili"), { trust: 50, fear: 0, anger: 0, tianDaoAlert: 0 });

    const first = evaluateArtifactUnlocks(sessionId);
    const second = evaluateArtifactUnlocks(sessionId);
    expect(first.newlyGranted).toContain("fentian_ling");
    expect(second.newlyGranted).not.toContain("fentian_ling");
  });

  it("evaluateArtifactUnlocks grants yinggu_fu when huashen_seed milestone is unlocked", async () => {
    const sessionId = await createSession();
    updatePlayer(sessionId, { cultivationStageIdx: 12 });
    evaluateMilestones(sessionId);

    const result = evaluateArtifactUnlocks(sessionId);
    expect(result.newlyGranted).toContain("yinggu_fu");
  });

  it("equipArtifact + getEquippedArtifactIds round-trip", async () => {
    const sessionId = await createSession();
    applyStateDelta(scopedNpcId(sessionId, "baili"), { trust: 50, fear: 0, anger: 0, tianDaoAlert: 0 });
    evaluateArtifactUnlocks(sessionId);

    equipArtifact(sessionId, "fentian_ling");
    expect(getEquippedArtifactIds(sessionId)).toContain("fentian_ling");

    unequipArtifact(sessionId, "fentian_ling");
    expect(getEquippedArtifactIds(sessionId)).not.toContain("fentian_ling");
  });

  it("equipArtifact throws ArtifactError when player doesn't own the artifact", async () => {
    const sessionId = await createSession();
    expect(() => equipArtifact(sessionId, "fentian_ling")).toThrow(/尚未拥有/);
  });

  it("buildEquippedPromptHints only emits hints for matching NPC", async () => {
    const sessionId = await createSession();
    applyStateDelta(scopedNpcId(sessionId, "baili"), { trust: 50, fear: 0, anger: 0, tianDaoAlert: 0 });
    evaluateArtifactUnlocks(sessionId);
    equipArtifact(sessionId, "fentian_ling");

    const hintsBaili = buildEquippedPromptHints(sessionId, "baili");
    const hintsSuhe = buildEquippedPromptHints(sessionId, "suhe");

    expect(hintsBaili.length).toBeGreaterThan(0);
    expect(hintsBaili[0]).toMatch(/焚天令/);
    expect(hintsSuhe).toEqual([]);
  });

  it("buildEquippedTagList returns visible tags for all equipped artifacts", async () => {
    const sessionId = await createSession();
    updatePlayer(sessionId, { cultivationStageIdx: 12 });
    evaluateMilestones(sessionId);
    evaluateArtifactUnlocks(sessionId);
    equipArtifact(sessionId, "yinggu_fu");

    const tags = buildEquippedTagList(sessionId);
    expect(tags).toContain("贴影骨符");
  });
});

describe("artifact route", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    process.env.NODE_ENV = "test";
    clearSessionsForTests();
    resetGameState();
    clearAllMemoriesForTests();
    clearInventoryForTests();
    clearQuestProgressForTests();
    clearRelationsForTests();
    clearWorldStateForTests();
    clearEquippedArtifactsForTests();
  });

  it("GET /api/artifacts/:sessionId returns owned and catalog", async () => {
    const app = createApp();
    const sessionId = await createSession();

    const res = await request(app).get(`/api/artifacts/${sessionId}`).expect(200);
    expect(res.body.owned).toEqual([]);
    expect(res.body.catalog).toHaveLength(3);
    expect(res.body.catalog.map((a: { id: string }) => a.id).sort()).toEqual([
      "fentian_ling",
      "mieshen_zhen",
      "yinggu_fu"
    ]);
  });

  it("POST /equip → POST /unequip flips equipped state", async () => {
    const app = createApp();
    const sessionId = await createSession();
    applyStateDelta(scopedNpcId(sessionId, "baili"), { trust: 50, fear: 0, anger: 0, tianDaoAlert: 0 });
    evaluateArtifactUnlocks(sessionId);

    await request(app)
      .post(`/api/artifacts/${sessionId}/equip`)
      .send({ artifactId: "fentian_ling" })
      .expect(200);

    let owned = (await request(app).get(`/api/artifacts/${sessionId}`).expect(200)).body.owned;
    expect(owned.find((o: { id: string; equipped: boolean }) => o.id === "fentian_ling").equipped).toBe(true);

    await request(app)
      .post(`/api/artifacts/${sessionId}/unequip`)
      .send({ artifactId: "fentian_ling" })
      .expect(200);

    owned = (await request(app).get(`/api/artifacts/${sessionId}`).expect(200)).body.owned;
    expect(owned.find((o: { id: string; equipped: boolean }) => o.id === "fentian_ling").equipped).toBe(false);
  });

  it("returns 409 when trying to equip an artifact the player doesn't own", async () => {
    const app = createApp();
    const sessionId = await createSession();
    await request(app)
      .post(`/api/artifacts/${sessionId}/equip`)
      .send({ artifactId: "fentian_ling" })
      .expect(409);
  });

  it("returns 400 for unknown artifactId", async () => {
    const app = createApp();
    const sessionId = await createSession();
    await request(app)
      .post(`/api/artifacts/${sessionId}/equip`)
      .send({ artifactId: "nonexistent_relic" })
      .expect(400);
  });

  it("returns 404 for unknown sessionId", async () => {
    const app = createApp();
    await request(app)
      .post("/api/artifacts/11111111-1111-4111-8111-111111111111/equip")
      .send({ artifactId: "fentian_ling" })
      .expect(404);
  });
});
