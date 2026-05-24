import { fetchJsonWithRetry } from "./apiClient";
import { normalizeInventory, normalizePlayer, type InventoryItem, type NpcStateSnapshot, type PlayerState } from "./sessionApi";

export type UseItemResponse = {
  player: PlayerState;
  npcState: NpcStateSnapshot | null;
  inventory: InventoryItem[];
  message: string;
};

export async function consumeInventoryItem(sessionId: string, itemId: string): Promise<UseItemResponse> {
  const raw = await fetchJsonWithRetry("/api/inventory/use", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, itemId })
  });

  return normalizeUseItemResponse(raw);
}

function normalizeUseItemResponse(raw: unknown): UseItemResponse {
  const record = isRecord(raw) ? raw : {};

  return {
    player: normalizePlayer(record.player),
    npcState: normalizeNpcState(record.npcState),
    inventory: normalizeInventory(record.inventory),
    message: typeof record.message === "string" ? record.message : ""
  };
}

function normalizeNpcState(raw: unknown): NpcStateSnapshot | null {
  if (!isRecord(raw)) {
    return null;
  }

  return {
    trust: normalizeNumber(raw.trust, 20),
    fear: normalizeNumber(raw.fear, 10),
    anger: normalizeNumber(raw.anger, 0),
    tianDaoAlert: normalizeNumber(raw.tianDaoAlert, 45)
  };
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
