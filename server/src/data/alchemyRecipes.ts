import type { RootElement } from "../types/player.js";

export type MaterialRequirement = {
  itemId: string;
  quantity: number;
};

export type AlchemyRecipe = {
  id: string;
  name: string;
  description: string;
  requiredMaterials: MaterialRequirement[];
  fireSweetSpot: number;
  fireTolerance: number;
  baseSuccessRate: number;
  rootWeights: Record<RootElement, number>;
  outputItemId: string;
};

export const alchemyRecipes: Record<string, AlchemyRecipe> = {
  cloud_veil_pill: {
    id: "cloud_veil_pill",
    name: "遮云丹",
    description: "压低天道云警戒，突破前服用最稳。",
    requiredMaterials: [
      { itemId: "shadow_herb", quantity: 2 },
      { itemId: "ash_salt", quantity: 1 }
    ],
    fireSweetSpot: 62,
    fireTolerance: 22,
    baseSuccessRate: 0.68,
    rootWeights: {
      metal: 0.35,
      wood: 0.25,
      water: 0.1,
      fire: 0.2,
      earth: 0.1
    },
    outputItemId: "cloud_veil_pill"
  },
  breakthrough_pill: {
    id: "breakthrough_pill",
    name: "破境丹",
    description: "提升下一次突破成功率，火候偏高才成丹。",
    requiredMaterials: [
      { itemId: "shadow_herb", quantity: 1 },
      { itemId: "ash_salt", quantity: 2 }
    ],
    fireSweetSpot: 74,
    fireTolerance: 18,
    baseSuccessRate: 0.56,
    rootWeights: {
      metal: 0.25,
      wood: 0.2,
      water: 0.1,
      fire: 0.35,
      earth: 0.1
    },
    outputItemId: "breakthrough_pill"
  }
};

export function getAlchemyRecipe(recipeId: string): AlchemyRecipe | null {
  return alchemyRecipes[recipeId] ?? null;
}
