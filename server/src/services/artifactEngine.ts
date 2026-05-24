import {
  ARTIFACTS,
  getArtifact,
  isArtifactId,
  type ArtifactDefinition,
  type ArtifactId
} from "../data/artifacts.js";
import type { MilestoneId } from "../data/milestones.js";
import { getAllNpcStatesForSession } from "./gameState.js";
import { getDb } from "../db/connection.js";
import { addItem, getInventory } from "./inventoryStore.js";
import { getPlayer } from "./playerStore.js";
import { getUnlockedMilestones, getWorldState } from "./worldStateEngine.js";

export type OwnedArtifact = {
  id: ArtifactId;
  equipped: boolean;
};

export function getOwnedArtifacts(sessionId: string): OwnedArtifact[] {
  const inventory = getInventory(sessionId);
  const equipped = new Set(getEquippedArtifactIds(sessionId));
  return inventory
    .filter((entry) => isArtifactId(entry.itemId) && entry.quantity > 0)
    .map((entry) => ({
      id: entry.itemId as ArtifactId,
      equipped: equipped.has(entry.itemId as ArtifactId)
    }));
}

export function getEquippedArtifactIds(sessionId: string): ArtifactId[] {
  const rows = getDb()
    .prepare(
      "SELECT item_id FROM equipped_artifacts WHERE session_id = ? ORDER BY equipped_at ASC"
    )
    .all(sessionId) as Array<{ item_id: string }>;
  return rows.map((row) => row.item_id as ArtifactId).filter(isArtifactId);
}

export function equipArtifact(sessionId: string, id: ArtifactId): void {
  if (!ownsArtifact(sessionId, id)) {
    throw new ArtifactError("尚未拥有该法宝。", 409);
  }
  const equippedAt = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO equipped_artifacts (session_id, item_id, equipped_at) VALUES (?, ?, ?)
       ON CONFLICT(session_id, item_id) DO UPDATE SET equipped_at = excluded.equipped_at`
    )
    .run(sessionId, id, equippedAt);
}

export function unequipArtifact(sessionId: string, id: ArtifactId): void {
  getDb()
    .prepare("DELETE FROM equipped_artifacts WHERE session_id = ? AND item_id = ?")
    .run(sessionId, id);
}

export type ArtifactUnlockResult = {
  newlyGranted: ArtifactId[];
};

export function evaluateArtifactUnlocks(sessionId: string): ArtifactUnlockResult {
  const player = getPlayer(sessionId);
  if (!player) return { newlyGranted: [] };

  const flags = getWorldState(sessionId);
  const npcStates = getAllNpcStatesForSession(sessionId);
  const unlockedMilestones = new Set(
    getUnlockedMilestones(sessionId).map((m) => m.id as MilestoneId)
  );

  const owned = new Set(
    getInventory(sessionId)
      .filter((entry) => isArtifactId(entry.itemId) && entry.quantity > 0)
      .map((entry) => entry.itemId)
  );

  const newlyGranted: ArtifactId[] = [];

  for (const def of ARTIFACTS) {
    if (owned.has(def.id)) continue;
    if (def.unlockedBy({ flags, player, npcStates, unlockedMilestones })) {
      addItem(sessionId, def.id, 1);
      newlyGranted.push(def.id);
    }
  }

  return { newlyGranted };
}

export function buildEquippedPromptHints(sessionId: string, npcId: string): string[] {
  const equipped = getEquippedArtifactIds(sessionId);
  if (equipped.length === 0) return [];

  const hints: string[] = [];
  for (const id of equipped) {
    const def = getArtifact(id);
    if (!def) continue;
    const trigger = def.promptTrigger;
    if (trigger.npcIds === "*" || trigger.npcIds.includes(npcId)) {
      hints.push(trigger.hint);
    }
  }
  return hints;
}

export function buildEquippedTagList(sessionId: string): string[] {
  const equipped = getEquippedArtifactIds(sessionId);
  return equipped
    .map((id) => getArtifact(id)?.visibleTag ?? null)
    .filter((tag): tag is string => Boolean(tag));
}

export function clearEquippedArtifactsForTests(): void {
  getDb().prepare("DELETE FROM equipped_artifacts").run();
}

export class ArtifactError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ArtifactError";
  }
}

function ownsArtifact(sessionId: string, id: ArtifactId): boolean {
  const inventory = getInventory(sessionId);
  return inventory.some((entry) => entry.itemId === id && entry.quantity > 0);
}

export type { ArtifactDefinition };
