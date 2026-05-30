import { describe, expect, it } from "vitest";
import { calculateBreakthrough, calculateCultivationGain } from "../services/cultivationEngine.js";
import type { PlayerState } from "../types/player.js";

const basePlayer: PlayerState = {
  id: "player",
  sessionId: "session",
  name: "陆玄",
  realm: "练气期",
  hasIllegalSeal: true,
  visibleTraits: [],
  recentActions: [],
  spiritStones: 0,
  qiCurrent: 0,
  qiCap: 100,
  cultivationStageIdx: 0,
  roots: { metal: 70, wood: 40, water: 12, fire: 8, earth: 16 },
  activeTechniqueId: "basic_breathing",
  breakthroughBonusUntil: null,
  alertShieldUntil: null,
  alertShieldStrength: 0,
  passiveIncomeClaimedAt: null
};

describe("cultivationEngine", () => {
  it("calculates qi gain and clamps at cap", () => {
    const result = calculateCultivationGain({ ...basePlayer, qiCurrent: 95 }, 300);

    expect(result.qiCurrent).toBe(100);
    expect(result.qiGained).toBe(5);
    expect(result.durationAccepted).toBe(300);
  });

  it("blocks breakthrough when qi is not full", () => {
    const result = calculateBreakthrough({ ...basePlayer, qiCurrent: 50 }, 20, () => 0);

    expect(result.success).toBe(false);
    expect(result.message).toContain("灵气未满");
  });

  it("advances stage on successful breakthrough", () => {
    const result = calculateBreakthrough({ ...basePlayer, qiCurrent: 100 }, 0, () => 0);

    expect(result.success).toBe(true);
    expect(result.cultivationStageIdx).toBe(1);
    expect(result.qiCurrent).toBe(0);
    expect(result.qiCap).toBeGreaterThan(basePlayer.qiCap);
  });

  it("penalizes failed high-alert breakthrough", () => {
    const result = calculateBreakthrough({ ...basePlayer, qiCurrent: 100 }, 90, () => 1);

    expect(result.success).toBe(false);
    expect(result.riskLevel).toBe("high");
    expect(result.alertDelta).toBe(10);
    expect(result.qiCurrent).toBeLessThan(100);
  });
});
