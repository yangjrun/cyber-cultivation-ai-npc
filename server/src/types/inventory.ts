import type { ItemDefinition } from "../data/items.js";

export type InventoryItem = {
  itemId: string;
  quantity: number;
  item: ItemDefinition | null;
};

export type ItemQuantity = {
  itemId: string;
  quantity: number;
};
