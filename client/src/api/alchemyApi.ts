import { fetchJsonWithRetry } from "./apiClient";
import { normalizeInventory, type InventoryItem, type ItemDefinition } from "./sessionApi";

export type MaterialSelection = {
  itemId: string;
  quantity: number;
};

export type RefineResponse = {
  success: boolean;
  quality: string;
  resultItem: ItemDefinition | null;
  inventory: InventoryItem[];
  message: string;
};

export async function refineAlchemy(sessionId: string, recipeId: string, materials: MaterialSelection[], fireLevel: number): Promise<RefineResponse> {
  const raw = await fetchJsonWithRetry("/api/alchemy/refine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, recipeId, materials, fireLevel })
  });

  return normalizeRefineResponse(raw);
}

function normalizeRefineResponse(raw: unknown): RefineResponse {
  const record = isRecord(raw) ? raw : {};

  return {
    success: record.success === true,
    quality: typeof record.quality === "string" ? record.quality : "failed",
    resultItem: normalizeItemDefinition(record.resultItem),
    inventory: normalizeInventory(record.inventory),
    message: typeof record.message === "string" ? record.message : ""
  };
}

function normalizeItemDefinition(raw: unknown): ItemDefinition | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = typeof raw.id === "string" ? raw.id : "";
  const name = typeof raw.name === "string" ? raw.name : "";
  const type = typeof raw.type === "string" ? raw.type : "";

  if (!id || !name || !["material", "pill", "junk"].includes(type)) {
    return null;
  }

  return {
    id,
    name,
    type: type as ItemDefinition["type"],
    description: typeof raw.description === "string" ? raw.description : ""
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
