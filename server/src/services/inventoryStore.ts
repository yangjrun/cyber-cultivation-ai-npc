import { starterInventory, getItemDefinition } from "../data/items.js";
import { getDb } from "../db/connection.js";
import type { InventoryItem, ItemQuantity } from "../types/inventory.js";

type InventoryRow = {
  item_id: string;
  quantity: number;
};

export function initializeStarterInventory(sessionId: string): void {
  for (const item of starterInventory) {
    addItem(sessionId, item.itemId, item.quantity);
  }
}

export function getInventory(sessionId: string): InventoryItem[] {
  const rows = getDb()
    .prepare("SELECT item_id, quantity FROM player_items WHERE session_id = ? AND quantity > 0 ORDER BY item_id ASC")
    .all(sessionId) as InventoryRow[];

  return rows.map((row) => ({
    itemId: row.item_id,
    quantity: row.quantity,
    item: getItemDefinition(row.item_id)
  }));
}

export function getItemQuantity(sessionId: string, itemId: string): number {
  const row = getDb()
    .prepare("SELECT quantity FROM player_items WHERE session_id = ? AND item_id = ?")
    .get(sessionId, itemId) as { quantity: number } | undefined;

  return row?.quantity ?? 0;
}

export function addItem(sessionId: string, itemId: string, quantity: number): InventoryItem[] {
  const safeQuantity = normalizeQuantity(quantity);

  if (safeQuantity <= 0) {
    return getInventory(sessionId);
  }

  getDb()
    .prepare(
      `INSERT INTO player_items (session_id, item_id, quantity, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id, item_id) DO UPDATE SET
        quantity = player_items.quantity + excluded.quantity,
        updated_at = excluded.updated_at`
    )
    .run(sessionId, itemId, safeQuantity, new Date().toISOString());

  return getInventory(sessionId);
}

export function consumeItems(sessionId: string, requirements: ItemQuantity[]): InventoryItem[] {
  const normalized = requirements.map((requirement) => ({
    itemId: requirement.itemId,
    quantity: normalizeQuantity(requirement.quantity)
  }));

  for (const requirement of normalized) {
    if (requirement.quantity <= 0) {
      continue;
    }

    if (getItemQuantity(sessionId, requirement.itemId) < requirement.quantity) {
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
       WHERE session_id = ? AND item_id = ?`
    ).run(requirement.quantity, new Date().toISOString(), sessionId, requirement.itemId);
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
