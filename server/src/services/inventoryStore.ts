import { starterInventory, getItemDefinition } from "../data/items.js";
import { getDb } from "../db/connection.js";
import type { InventoryItem, ItemQuantity } from "../types/inventory.js";
import type { AlchemyQuality } from "./alchemyEngine.js";

type InventoryRow = {
  item_id: string;
  quantity: number;
  quality: string | null;
};

export function initializeStarterInventory(sessionId: string): void {
  for (const item of starterInventory) {
    addItem(sessionId, item.itemId, item.quantity);
  }
}

export function getInventory(sessionId: string): InventoryItem[] {
  const rows = getDb()
    .prepare("SELECT item_id, quantity, quality FROM player_items WHERE session_id = ? AND quantity > 0 ORDER BY item_id ASC, quality ASC")
    .all(sessionId) as InventoryRow[];

  return rows.map((row) => ({
    itemId: row.item_id,
    quantity: row.quantity,
    quality: (row.quality as AlchemyQuality | null) ?? undefined,
    item: getItemDefinition(row.item_id)
  }));
}

export function getItemQuantity(sessionId: string, itemId: string, quality?: AlchemyQuality): number {
  const row = getDb()
    .prepare("SELECT quantity FROM player_items WHERE session_id = ? AND item_id = ? AND (quality IS ? OR (quality IS NULL AND ? IS NULL))")
    .get(sessionId, itemId, quality ?? null, quality ?? null) as { quantity: number } | undefined;

  return row?.quantity ?? 0;
}

export function addItem(sessionId: string, itemId: string, quantity: number, quality?: AlchemyQuality): InventoryItem[] {
  const safeQuantity = normalizeQuantity(quantity);

  if (safeQuantity <= 0) {
    return getInventory(sessionId);
  }

  const db = getDb();

  // Check if item already exists
  const existing = db
    .prepare("SELECT quantity FROM player_items WHERE session_id = ? AND item_id = ? AND (quality IS ? OR (quality IS NULL AND ? IS NULL))")
    .get(sessionId, itemId, quality ?? null, quality ?? null) as { quantity: number } | undefined;

  if (existing) {
    // Update existing item
    db.prepare(
      `UPDATE player_items
       SET quantity = quantity + ?, updated_at = ?
       WHERE session_id = ? AND item_id = ? AND (quality IS ? OR (quality IS NULL AND ? IS NULL))`
    ).run(safeQuantity, new Date().toISOString(), sessionId, itemId, quality ?? null, quality ?? null);
  } else {
    // Insert new item
    db.prepare(
      `INSERT INTO player_items (session_id, item_id, quantity, quality, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(sessionId, itemId, safeQuantity, quality ?? null, new Date().toISOString());
  }

  return getInventory(sessionId);
}

export function consumeItems(sessionId: string, requirements: ItemQuantity[]): InventoryItem[] {
  const normalized = requirements.map((requirement) => ({
    itemId: requirement.itemId,
    quantity: normalizeQuantity(requirement.quantity),
    quality: requirement.quality
  }));

  for (const requirement of normalized) {
    if (requirement.quantity <= 0) {
      continue;
    }

    if (getItemQuantity(sessionId, requirement.itemId, requirement.quality) < requirement.quantity) {
      throw new Error("Insufficient inventory");
    }
  }

  const db = getDb();
  for (const requirement of normalized) {
    if (requirement.quantity <= 0) {
      continue;
    }

    db.prepare(
      `UPDATE player_items
       SET quantity = quantity - ?, updated_at = ?
       WHERE session_id = ? AND item_id = ? AND (quality IS ? OR (quality IS NULL AND ? IS NULL))`
    ).run(requirement.quantity, new Date().toISOString(), sessionId, requirement.itemId, requirement.quality ?? null, requirement.quality ?? null);
  }

  db.prepare("DELETE FROM player_items WHERE session_id = ? AND quantity <= 0").run(sessionId);

  return getInventory(sessionId);
}

export function clearInventoryForTests(): void {
  getDb().prepare("DELETE FROM player_items").run();
}

function normalizeQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return 0;
  }

  return Math.max(0, Math.trunc(quantity));
}
