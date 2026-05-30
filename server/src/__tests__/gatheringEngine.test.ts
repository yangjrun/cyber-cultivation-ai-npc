import { describe, expect, it } from "vitest";
import { calculateGathering, type GatheringPoint } from "../services/gatheringEngine.js";
import { defaultRoots } from "../data/cultivationBalance.js";
import type { PlayerState } from "../types/player.js";

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: "player-1",
    sessionId: "session-1",
    name: "测试者",
    realm: "练气期",
    hasIllegalSeal: true,
    visibleTraits: [],
    recentActions: [],
    spiritStones: 100,
    qiCurrent: 100,
    qiCap: 100,
    cultivationStageIdx: 0,
    roots: { ...defaultRoots },
    activeTechniqueId: "basic_breathing",
    breakthroughBonusUntil: null,
    alertShieldUntil: null,
    alertShieldStrength: 0,
    passiveIncomeClaimedAt: null,
    ...overrides
  };
}

function makePoint(overrides: Partial<GatheringPoint> = {}): GatheringPoint {
  return {
    pointId: "test_point",
    sceneId: "test_scene",
    name: "测试采集点",
    description: "测试用",
    qiCost: 10,
    cooldownHours: 6,
    alertRisk: 2,
    possibleItems: [
      { itemId: "shadow_herb", probability: 0.5, quantityMin: 1, quantityMax: 2 }
    ],
    ...overrides
  };
}

describe("gatheringEngine.calculateGathering", () => {
  it("fails when player has insufficient qi", () => {
    const player = makePlayer({ qiCurrent: 5 });
    const point = makePoint({ qiCost: 10 });
    const result = calculateGathering(player, point, () => 0.1);

    expect(result.success).toBe(false);
    expect(result.qiCost).toBe(0);
    expect(result.itemsGained).toEqual([]);
    expect(result.message).toContain("灵气不足");
  });

  it("succeeds with a low random roll", () => {
    const player = makePlayer();
    const point = makePoint();
    // First roll (success check) low = success, second roll (item) low = item gained
    const result = calculateGathering(player, point, () => 0.1);

    expect(result.success).toBe(true);
    expect(result.qiCost).toBe(10);
    expect(result.itemsGained.length).toBeGreaterThan(0);
    expect(result.nextAvailableAt).toBeTruthy();
  });

  it("fails with a high random roll", () => {
    const player = makePlayer();
    const point = makePoint();
    // High roll = failure
    const result = calculateGathering(player, point, () => 0.99);

    expect(result.success).toBe(false);
    expect(result.qiCost).toBe(10);
    expect(result.itemsGained).toEqual([]);
    expect(result.nextAvailableAt).toBeTruthy();
  });

  it("higher cultivation stage increases success rate", () => {
    const novice = makePlayer({ cultivationStageIdx: 0 });
    const master = makePlayer({ cultivationStageIdx: 14 });
    const point = makePoint();

    // A roll of 0.8 should fail for novice (0.6 base) but succeed for master (0.6 + 0.28 = 0.88)
    const noviceResult = calculateGathering(novice, point, () => 0.8);
    const masterResult = calculateGathering(master, point, () => 0.8);

    expect(noviceResult.success).toBe(false);
    expect(masterResult.success).toBe(true);
  });

  it("returns alert delta matching point alertRisk", () => {
    const player = makePlayer();
    const point = makePoint({ alertRisk: 5 });
    const result = calculateGathering(player, point, () => 0.1);

    expect(result.alertDelta).toBe(5);
  });

  it("gives a fallback item when success but no probability hits", () => {
    const player = makePlayer();
    const point = makePoint({
      possibleItems: [
        { itemId: "shadow_herb", probability: 0.01, quantityMin: 1, quantityMax: 1 }
      ]
    });

    // success roll low, but item roll high (misses probability)
    let callCount = 0;
    const random = () => {
      callCount += 1;
      return callCount === 1 ? 0.1 : 0.99; // first roll succeeds, item roll misses
    };

    const result = calculateGathering(player, point, random);

    expect(result.success).toBe(true);
    expect(result.itemsGained.length).toBe(1); // fallback item
    expect(result.itemsGained[0].itemId).toBe("shadow_herb");
  });

  it("respects quantity range for gathered items", () => {
    const player = makePlayer();
    const point = makePoint({
      possibleItems: [
        { itemId: "shadow_herb", probability: 1.0, quantityMin: 2, quantityMax: 4 }
      ]
    });

    const result = calculateGathering(player, point, () => 0.1);

    expect(result.success).toBe(true);
    const item = result.itemsGained.find((i) => i.itemId === "shadow_herb");
    expect(item).toBeDefined();
    expect(item!.quantity).toBeGreaterThanOrEqual(2);
    expect(item!.quantity).toBeLessThanOrEqual(4);
  });
});
