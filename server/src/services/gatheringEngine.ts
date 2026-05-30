import type { PlayerState } from "../types/player.js";

export type GatheringPoint = {
  pointId: string;
  sceneId: string;
  name: string;
  description: string;
  qiCost: number;
  cooldownHours: number;
  alertRisk: number; // 0-10, added to tianDaoAlert
  possibleItems: Array<{
    itemId: string;
    probability: number; // 0-1
    quantityMin: number;
    quantityMax: number;
  }>;
};

export type GatheringResult = {
  success: boolean;
  itemsGained: Array<{ itemId: string; quantity: number }>;
  qiCost: number;
  alertDelta: number;
  message: string;
  nextAvailableAt: string | null;
};

/**
 * Calculate gathering outcome based on player state and gathering point
 */
export function calculateGathering(
  player: PlayerState,
  point: GatheringPoint,
  random = Math.random
): GatheringResult {
  const qiCost = point.qiCost;
  const alertDelta = point.alertRisk;

  // Check if player has enough qi
  if (player.qiCurrent < qiCost) {
    return {
      success: false,
      itemsGained: [],
      qiCost: 0,
      alertDelta: 0,
      message: "灵气不足，无法采集。",
      nextAvailableAt: null
    };
  }

  // Calculate success rate based on cultivation stage
  // Higher cultivation = better success rate
  const baseSuccessRate = 0.6;
  const stageBonus = player.cultivationStageIdx * 0.02; // +2% per stage
  const successRate = clamp(baseSuccessRate + stageBonus, 0.3, 0.95);

  const roll = random();
  const success = roll < successRate;

  if (!success) {
    return {
      success: false,
      itemsGained: [],
      qiCost,
      alertDelta,
      message: "采集失败，什么也没找到。",
      nextAvailableAt: calculateNextAvailable(point.cooldownHours)
    };
  }

  // Determine which items are gathered
  const itemsGained: Array<{ itemId: string; quantity: number }> = [];

  for (const possibleItem of point.possibleItems) {
    if (random() < possibleItem.probability) {
      const quantity = Math.floor(
        possibleItem.quantityMin +
        random() * (possibleItem.quantityMax - possibleItem.quantityMin + 1)
      );
      itemsGained.push({ itemId: possibleItem.itemId, quantity });
    }
  }

  // If no items were gathered despite success, give a consolation item
  if (itemsGained.length === 0 && point.possibleItems.length > 0) {
    const fallbackItem = point.possibleItems[0];
    itemsGained.push({
      itemId: fallbackItem.itemId,
      quantity: fallbackItem.quantityMin
    });
  }

  const itemNames = itemsGained.map((item) => `${item.itemId} ×${item.quantity}`).join("、");
  const message = `采集成功，获得：${itemNames}。`;

  return {
    success: true,
    itemsGained,
    qiCost,
    alertDelta,
    message,
    nextAvailableAt: calculateNextAvailable(point.cooldownHours)
  };
}

function calculateNextAvailable(cooldownHours: number): string {
  const now = new Date();
  const nextAvailable = new Date(now.getTime() + cooldownHours * 60 * 60 * 1000);
  return nextAvailable.toISOString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
