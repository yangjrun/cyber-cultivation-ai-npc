import type { GatheringPoint } from "../services/gatheringEngine.js";

export const gatheringPoints: Record<string, GatheringPoint> = {
  black_market_herbs: {
    pointId: "black_market_herbs",
    sceneId: "black_market",
    name: "废弃药摊",
    description: "黑市角落的废弃药摊，偶尔能翻到些残次品。",
    qiCost: 10,
    cooldownHours: 6,
    alertRisk: 1,
    possibleItems: [
      { itemId: "shadow_herb", probability: 0.3, quantityMin: 1, quantityMax: 2 },
      { itemId: "failed_dregs", probability: 0.6, quantityMin: 1, quantityMax: 3 }
    ]
  },
  inspector_ruins: {
    pointId: "inspector_ruins",
    sceneId: "inspector_outpost",
    name: "雷罚废墟",
    description: "监察院外围的雷击遗迹，劫灰盐的来源，但天道镜盯得紧。",
    qiCost: 15,
    cooldownHours: 8,
    alertRisk: 5,
    possibleItems: [
      { itemId: "ash_salt", probability: 0.5, quantityMin: 1, quantityMax: 2 },
      { itemId: "shadow_herb", probability: 0.2, quantityMin: 1, quantityMax: 1 }
    ]
  },
  tavern_scraps: {
    pointId: "tavern_scraps",
    sceneId: "thunder_tavern",
    name: "酒馆后巷",
    description: "雷罚酒馆后巷的垃圾堆，散修们丢弃的杂物。",
    qiCost: 8,
    cooldownHours: 4,
    alertRisk: 0,
    possibleItems: [
      { itemId: "failed_dregs", probability: 0.7, quantityMin: 2, quantityMax: 4 },
      { itemId: "shadow_herb", probability: 0.15, quantityMin: 1, quantityMax: 1 }
    ]
  },
  cave_garden: {
    pointId: "cave_garden",
    sceneId: "player_cave",
    name: "洞府灵田",
    description: "你的洞府里开辟的小灵田，可以种些低阶灵草。",
    qiCost: 5,
    cooldownHours: 12,
    alertRisk: 0,
    possibleItems: [
      { itemId: "shadow_herb", probability: 0.4, quantityMin: 1, quantityMax: 2 },
      { itemId: "ash_salt", probability: 0.3, quantityMin: 1, quantityMax: 1 }
    ]
  }
};

export function getGatheringPoint(pointId: string): GatheringPoint | null {
  return gatheringPoints[pointId] ?? null;
}

export function getGatheringPointsByScene(sceneId: string): GatheringPoint[] {
  return Object.values(gatheringPoints).filter((point) => point.sceneId === sceneId);
}

export function listGatheringPointIds(): string[] {
  return Object.keys(gatheringPoints);
}
