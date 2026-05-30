import { fetchJsonWithRetry } from "./apiClient";
import {
  normalizeInventory,
  normalizeItemDefinition,
  normalizePlayer,
  type InventoryItem,
  type ItemDefinition,
  type PlayerState
} from "./sessionApi";

export type GatheringPointInfo = {
  pointId: string;
  name: string;
  description: string;
  qiCost: number;
  cooldownHours: number;
  alertRisk: number;
  available: boolean;
  nextAvailableAt: string | null;
};

export type GatheredItem = {
  itemId: string;
  quantity: number;
  item: ItemDefinition | null;
};

export type GatherResponse = {
  success: boolean;
  itemsGained: GatheredItem[];
  qiCost: number;
  alertDelta: number;
  message: string;
  nextAvailableAt: string | null;
  player: PlayerState;
  inventory: InventoryItem[];
};

export async function fetchGatheringPoints(sessionId: string, sceneId: string): Promise<GatheringPointInfo[]> {
  const raw = await fetchJsonWithRetry(
    `/api/gathering/${encodeURIComponent(sessionId)}/${encodeURIComponent(sceneId)}`
  );

  return normalizeGatheringPoints(isRecord(raw) ? raw.points : null);
}

export async function gather(sessionId: string, pointId: string): Promise<GatherResponse> {
  const raw = await fetchJsonWithRetry("/api/gathering/gather", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, pointId })
  });

  return normalizeGatherResponse(raw);
}

function normalizeGatheringPoints(raw: unknown): GatheringPointInfo[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((entry): GatheringPointInfo[] => {
    if (!isRecord(entry)) {
      return [];
    }

    const pointId = normalizeString(entry.pointId);

    if (!pointId) {
      return [];
    }

    return [
      {
        pointId,
        name: normalizeString(entry.name),
        description: normalizeString(entry.description),
        qiCost: normalizeNumber(entry.qiCost, 0),
        cooldownHours: normalizeNumber(entry.cooldownHours, 0),
        alertRisk: normalizeNumber(entry.alertRisk, 0),
        available: entry.available === true,
        nextAvailableAt: typeof entry.nextAvailableAt === "string" ? entry.nextAvailableAt : null
      }
    ];
  });
}

function normalizeGatherResponse(raw: unknown): GatherResponse {
  const record = isRecord(raw) ? raw : {};

  return {
    success: record.success === true,
    itemsGained: normalizeGatheredItems(record.itemsGained),
    qiCost: normalizeNumber(record.qiCost, 0),
    alertDelta: normalizeNumber(record.alertDelta, 0),
    message: normalizeString(record.message),
    nextAvailableAt: typeof record.nextAvailableAt === "string" ? record.nextAvailableAt : null,
    player: normalizePlayer(record.player),
    inventory: normalizeInventory(record.inventory)
  };
}

function normalizeGatheredItems(raw: unknown): GatheredItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((entry): GatheredItem[] => {
    if (!isRecord(entry)) {
      return [];
    }

    const itemId = normalizeString(entry.itemId);

    if (!itemId) {
      return [];
    }

    return [
      {
        itemId,
        quantity: normalizeNumber(entry.quantity, 0),
        item: normalizeItemDefinition(entry.item)
      }
    ];
  });
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
