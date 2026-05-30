import { describe, expect, it } from "vitest";
import { getAlchemyRecipe } from "../data/alchemyRecipes.js";
import { calculateAlchemyRefine } from "../services/alchemyEngine.js";
import type { PlayerState } from "../types/player.js";

const player: PlayerState = {
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

describe("alchemyEngine", () => {
  it("creates recipe output on success", () => {
    const recipe = getAlchemyRecipe("cloud_veil_pill");

    expect(recipe).not.toBeNull();
    const result = calculateAlchemyRefine(player, recipe!, 62, () => 0);

    expect(result.success).toBe(true);
    expect(result.resultItemId).toBe("cloud_veil_pill");
    expect(result.quality).not.toBe("failed");
  });

  it("returns dregs on failure", () => {
    const recipe = getAlchemyRecipe("cloud_veil_pill");
    const result = calculateAlchemyRefine(player, recipe!, 0, () => 1);

    expect(result.success).toBe(false);
    expect(result.resultItemId).toBe("failed_dregs");
    expect(result.quality).toBe("failed");
  });
});
