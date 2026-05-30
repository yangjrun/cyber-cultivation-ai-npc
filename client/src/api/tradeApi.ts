import { fetchJsonWithRetry } from "./apiClient";
import {
  normalizeInventory,
  normalizeItemDefinition,
  normalizePlayer,
  type InventoryItem,
  type ItemDefinition,
  type NpcStateSnapshot,
  type PlayerState
} from "./sessionApi";

export type ShopBuyEntry = {
  itemId: string;
  item: ItemDefinition | null;
  quantity: number;
  buyUnitPrice: number;
};

export type ShopSellEntry = {
  itemId: string;
  item: ItemDefinition | null;
  quantity: number;
  sellUnitPrice: number;
};

export type ShopSnapshot = {
  npcId: string;
  npcName: string;
  npcSpiritStones: number;
  refused: boolean;
  reason: string | null;
  items: ShopBuyEntry[];
  sellQuotes: ShopSellEntry[];
};

export type TradeActionResponse = {
  kind: "buy" | "sell";
  itemId: string;
  item: ItemDefinition | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  player: PlayerState;
  inventory: InventoryItem[];
  npcState: NpcStateSnapshot | null;
  shop: ShopSnapshot;
  message: string;
};

export async function fetchShop(sessionId: string, npcId: string): Promise<ShopSnapshot> {
  const raw = await fetchJsonWithRetry(
    `/api/trade/${encodeURIComponent(sessionId)}/${encodeURIComponent(npcId)}`
  );
  return normalizeShop(isRecord(raw) ? raw.shop : null);
}

export async function buyItem(
  sessionId: string,
  npcId: string,
  itemId: string,
  quantity: number
): Promise<TradeActionResponse> {
  return postTrade("/api/trade/buy", { sessionId, npcId, itemId, quantity });
}

export async function sellItem(
  sessionId: string,
  npcId: string,
  itemId: string,
  quantity: number
): Promise<TradeActionResponse> {
  return postTrade("/api/trade/sell", { sessionId, npcId, itemId, quantity });
}

async function postTrade(
  path: string,
  body: { sessionId: string; npcId: string; itemId: string; quantity: number }
): Promise<TradeActionResponse> {
  const raw = await fetchJsonWithRetry(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  return normalizeTradeResponse(raw);
}

function normalizeTradeResponse(raw: unknown): TradeActionResponse {
  const record = isRecord(raw) ? raw : {};

  return {
    kind: record.kind === "sell" ? "sell" : "buy",
    itemId: normalizeString(record.itemId),
    item: normalizeItemDefinition(record.item),
    quantity: normalizeNumber(record.quantity, 0),
    unitPrice: normalizeNumber(record.unitPrice, 0),
    totalPrice: normalizeNumber(record.totalPrice, 0),
    player: normalizePlayer(record.player),
    inventory: normalizeInventory(record.inventory),
    npcState: normalizeNpcState(record.npcState),
    shop: normalizeShop(record.shop),
    message: normalizeString(record.message)
  };
}

function normalizeShop(raw: unknown): ShopSnapshot {
  const record = isRecord(raw) ? raw : {};

  return {
    npcId: normalizeString(record.npcId),
    npcName: normalizeString(record.npcName),
    npcSpiritStones: normalizeNumber(record.npcSpiritStones, 0),
    refused: record.refused === true,
    reason: typeof record.reason === "string" ? record.reason : null,
    items: normalizeBuyEntries(record.items),
    sellQuotes: normalizeSellEntries(record.sellQuotes)
  };
}

function normalizeBuyEntries(raw: unknown): ShopBuyEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((entry): ShopBuyEntry[] => {
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
        item: normalizeItemDefinition(entry.item),
        quantity: normalizeNumber(entry.quantity, 0),
        buyUnitPrice: normalizeNumber(entry.buyUnitPrice, 0)
      }
    ];
  });
}

function normalizeSellEntries(raw: unknown): ShopSellEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((entry): ShopSellEntry[] => {
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
        item: normalizeItemDefinition(entry.item),
        quantity: normalizeNumber(entry.quantity, 0),
        sellUnitPrice: normalizeNumber(entry.sellUnitPrice, 0)
      }
    ];
  });
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

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
