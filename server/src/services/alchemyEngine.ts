import type { AlchemyRecipe } from "../data/alchemyRecipes.js";
import type { PlayerState, RootElement } from "../types/player.js";

export type AlchemyQuality = "failed" | "common" | "fine" | "perfect";

export type AlchemyResult = {
  success: boolean;
  quality: AlchemyQuality;
  resultItemId: string;
  successRate: number;
  message: string;
};

export function calculateAlchemyRefine(player: PlayerState, recipe: AlchemyRecipe, fireLevel: number, random = Math.random): AlchemyResult {
  const safeFireLevel = clamp(Math.trunc(fireLevel), 0, 100);
  const fireDistance = Math.abs(safeFireLevel - recipe.fireSweetSpot);
  const fireScore = Math.max(0, 1 - fireDistance / Math.max(1, recipe.fireTolerance));
  const rootAffinity = calculateRootAffinity(player, recipe.rootWeights);
  const successRate = clamp(recipe.baseSuccessRate + fireScore * 0.18 + (rootAffinity - 1) * 0.18, 0.05, 0.95);
  const roll = random();

  if (roll > successRate) {
    return {
      success: false,
      quality: "failed",
      resultItemId: "failed_dregs",
      successRate,
      message: "炉火一偏，丹液焦成了黑渣。"
    };
  }

  const quality = fireScore > 0.9 && roll < successRate * 0.35
    ? "perfect"
    : fireScore > 0.65
      ? "fine"
      : "common";

  return {
    success: true,
    quality,
    resultItemId: recipe.outputItemId,
    successRate,
    message: quality === "perfect" ? "丹成上品，炉火干净得不像黑市货。" : "丹成，可以入喉。"
  };
}

function calculateRootAffinity(player: PlayerState, weights: Record<RootElement, number>): number {
  const weightedScore = Object.entries(weights).reduce((total, [element, weight]) => {
    return total + player.roots[element as RootElement] * weight;
  }, 0);

  return 0.7 + weightedScore / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
