import { randomUUID } from "node:crypto";
import { defaultRoots, getStageByIndex } from "../data/cultivationBalance.js";
import { getPlayerTrait, type PlayerTraitId } from "../data/playerTraits.js";
import { DEFAULT_SCENE_ID } from "../data/scenes.js";
import { getDb } from "../db/connection.js";
import { initializeStarterInventory } from "./inventoryStore.js";
import { initializeRelationsForSession } from "./npcRelationsStore.js";
import { initializeShopsForSession } from "./tradeStore.js";
import type { ElementRoots, PlayerState, RootElement, SessionSnapshot } from "../types/player.js";

export type CreateSessionInput = {
  name?: string;
  roots?: ElementRoots;
  traitId?: PlayerTraitId;
};

const defaultPlayer = {
  name: "陆玄",
  realm: "练气期",
  hasIllegalSeal: true,
  visibleTraits: ["右臂经脉", "雷罚残痕", "非法灵根烙印"],
  recentActions: ["救过白璃的药童"],
  spiritStones: 0,
  qiCurrent: 0,
  qiCap: 100,
  cultivationStageIdx: 0,
  roots: defaultRoots,
  activeTechniqueId: "basic_breathing",
  breakthroughBonusUntil: null,
  alertShieldUntil: null,
  alertShieldStrength: 0,
  passiveIncomeClaimedAt: null
} as const;

type ResolvedInitialPlayer = {
  name: string;
  visibleTraits: string[];
  recentActions: string[];
  roots: ElementRoots;
};

function resolveInitialPlayer(input?: CreateSessionInput): ResolvedInitialPlayer {
  const name = input?.name?.trim() ? input.name.trim() : defaultPlayer.name;
  const roots = input?.roots ? normalizeRoots(input.roots) : { ...defaultPlayer.roots };

  let visibleTraits: string[] = [...defaultPlayer.visibleTraits];
  let recentActions: string[] = [...defaultPlayer.recentActions];

  if (input?.traitId) {
    const trait = getPlayerTrait(input.traitId);
    visibleTraits = [...trait.visibleTraits];
    recentActions = [...trait.recentActions];
  }

  return { name, visibleTraits, recentActions, roots };
}

type PlayerRow = {
  id: string;
  session_id: string;
  name: string;
  realm: string;
  has_illegal_seal: number;
  visible_traits: string;
  recent_actions: string;
  spirit_stones: number;
  qi_current: number;
  qi_cap: number;
  cultivation_stage_idx: number;
  roots: string;
  active_technique_id: string;
  breakthrough_bonus_until: string | null;
  alert_shield_until: string | null;
  alert_shield_strength: number;
  passive_income_claimed_at: string | null;
};

export type PlayerPatch = Partial<Pick<
  PlayerState,
  "realm" |
  "spiritStones" |
  "qiCurrent" |
  "qiCap" |
  "cultivationStageIdx" |
  "roots" |
  "activeTechniqueId" |
  "breakthroughBonusUntil" |
  "alertShieldUntil" |
  "alertShieldStrength" |
  "passiveIncomeClaimedAt"
>>;

export function createSession(input?: CreateSessionInput): SessionSnapshot {
  const sessionId = randomUUID();
  const playerId = randomUUID();
  const createdAt = nowIso();
  const db = getDb();
  const initial = resolveInitialPlayer(input);

  db.transaction(() => {
    db.prepare("INSERT INTO sessions (id, created_at, updated_at) VALUES (?, ?, ?)")
      .run(sessionId, createdAt, createdAt);
    insertPlayer(sessionId, playerId, createdAt, initial);
    initializeStarterInventory(sessionId);
    db.prepare("INSERT INTO active_scene (session_id, scene_id, updated_at) VALUES (?, ?, ?)")
      .run(sessionId, DEFAULT_SCENE_ID, createdAt);
  })();

  initializeRelationsForSession(sessionId);
  initializeShopsForSession(sessionId);

  const session = getSession(sessionId);

  if (!session) {
    throw new Error("Failed to create session");
  }

  return session;
}

export function getSession(sessionId: string): SessionSnapshot | null {
  const player = getPlayer(sessionId);

  if (!player) {
    return null;
  }

  return {
    sessionId,
    playerId: player.id,
    player
  };
}

export function sessionExists(sessionId: string): boolean {
  const row = getDb().prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId) as { id: string } | undefined;
  return Boolean(row);
}

export function createPlayer(sessionId: string): PlayerState {
  const existing = getPlayer(sessionId);

  if (existing) {
    return existing;
  }

  const createdAt = nowIso();
  const playerId = randomUUID();
  insertPlayer(sessionId, playerId, createdAt, resolveInitialPlayer());
  initializeStarterInventory(sessionId);
  initializeShopsForSession(sessionId);

  const player = getPlayer(sessionId);

  if (!player) {
    throw new Error("Failed to create player");
  }

  return player;
}

export function getPlayer(sessionId: string): PlayerState | null {
  const row = getDb()
    .prepare(
      `SELECT id, session_id, name, realm, has_illegal_seal, visible_traits, recent_actions,
        spirit_stones, qi_current, qi_cap, cultivation_stage_idx, roots, active_technique_id,
        breakthrough_bonus_until, alert_shield_until, alert_shield_strength, passive_income_claimed_at
       FROM players
       WHERE session_id = ?`
    )
    .get(sessionId) as PlayerRow | undefined;

  return row ? mapPlayer(row) : null;
}

export function updatePlayer(sessionId: string, patch: PlayerPatch): PlayerState {
  const current = getPlayer(sessionId);

  if (!current) {
    throw new Error("Player not found");
  }

  const nextStageIdx = clampInteger(patch.cultivationStageIdx ?? current.cultivationStageIdx, 0, Number.MAX_SAFE_INTEGER);
  const stage = getStageByIndex(nextStageIdx);
  const nextQiCap = clampInteger(patch.qiCap ?? current.qiCap, 1, Number.MAX_SAFE_INTEGER);
  const next: PlayerState = {
    ...current,
    realm: patch.realm ?? stage.realm,
    spiritStones: clampInteger(patch.spiritStones ?? current.spiritStones, 0, Number.MAX_SAFE_INTEGER),
    qiCurrent: clampInteger(patch.qiCurrent ?? current.qiCurrent, 0, nextQiCap),
    qiCap: nextQiCap,
    cultivationStageIdx: nextStageIdx,
    roots: patch.roots ? normalizeRoots(patch.roots) : current.roots,
    activeTechniqueId: patch.activeTechniqueId ?? current.activeTechniqueId,
    breakthroughBonusUntil: patch.breakthroughBonusUntil ?? current.breakthroughBonusUntil,
    alertShieldUntil: patch.alertShieldUntil ?? current.alertShieldUntil,
    alertShieldStrength: clampInteger(patch.alertShieldStrength ?? current.alertShieldStrength, 0, 100),
    passiveIncomeClaimedAt: patch.passiveIncomeClaimedAt ?? current.passiveIncomeClaimedAt
  };

  const updatedAt = nowIso();
  getDb()
    .prepare(
      `UPDATE players
       SET realm = ?, spirit_stones = ?, qi_current = ?, qi_cap = ?, cultivation_stage_idx = ?, roots = ?,
        active_technique_id = ?, breakthrough_bonus_until = ?, alert_shield_until = ?, alert_shield_strength = ?,
        passive_income_claimed_at = ?, updated_at = ?
       WHERE session_id = ?`
    )
    .run(
      next.realm,
      next.spiritStones,
      next.qiCurrent,
      next.qiCap,
      next.cultivationStageIdx,
      JSON.stringify(next.roots),
      next.activeTechniqueId,
      next.breakthroughBonusUntil,
      next.alertShieldUntil,
      next.alertShieldStrength,
      next.passiveIncomeClaimedAt,
      updatedAt,
      sessionId
    );

  return next;
}

export function clearSessionsForTests(): void {
  getDb().prepare("DELETE FROM sessions").run();
}

function insertPlayer(sessionId: string, playerId: string, createdAt: string, initial: ResolvedInitialPlayer): void {
  getDb()
    .prepare(
      `INSERT INTO players (
        id, session_id, name, realm, has_illegal_seal, visible_traits, recent_actions,
        spirit_stones, qi_current, qi_cap, cultivation_stage_idx, roots, active_technique_id,
        breakthrough_bonus_until, alert_shield_until, alert_shield_strength, passive_income_claimed_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      playerId,
      sessionId,
      initial.name,
      defaultPlayer.realm,
      defaultPlayer.hasIllegalSeal ? 1 : 0,
      JSON.stringify(initial.visibleTraits),
      JSON.stringify(initial.recentActions),
      defaultPlayer.spiritStones,
      defaultPlayer.qiCurrent,
      defaultPlayer.qiCap,
      defaultPlayer.cultivationStageIdx,
      JSON.stringify(initial.roots),
      defaultPlayer.activeTechniqueId,
      defaultPlayer.breakthroughBonusUntil,
      defaultPlayer.alertShieldUntil,
      defaultPlayer.alertShieldStrength,
      defaultPlayer.passiveIncomeClaimedAt,
      createdAt,
      createdAt
    );
}

function mapPlayer(row: PlayerRow): PlayerState {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    realm: row.realm,
    hasIllegalSeal: row.has_illegal_seal === 1,
    visibleTraits: parseStringArray(row.visible_traits),
    recentActions: parseStringArray(row.recent_actions),
    spiritStones: row.spirit_stones,
    qiCurrent: row.qi_current,
    qiCap: row.qi_cap,
    cultivationStageIdx: row.cultivation_stage_idx,
    roots: parseRoots(row.roots),
    activeTechniqueId: row.active_technique_id,
    breakthroughBonusUntil: row.breakthrough_bonus_until,
    alertShieldUntil: row.alert_shield_until,
    alertShieldStrength: row.alert_shield_strength,
    passiveIncomeClaimedAt: row.passive_income_claimed_at
  };
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseRoots(value: string): ElementRoots {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRootRecord(parsed) ? normalizeRoots(parsed) : { ...defaultRoots };
  } catch {
    return { ...defaultRoots };
  }
}

function normalizeRoots(roots: ElementRoots): ElementRoots {
  return {
    metal: clampInteger(roots.metal, 0, 100),
    wood: clampInteger(roots.wood, 0, 100),
    water: clampInteger(roots.water, 0, 100),
    fire: clampInteger(roots.fire, 0, 100),
    earth: clampInteger(roots.earth, 0, 100)
  };
}

function isRootRecord(value: unknown): value is ElementRoots {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<RootElement, unknown>;
  return ["metal", "wood", "water", "fire", "earth"].every((key) => typeof record[key as RootElement] === "number");
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function nowIso(): string {
  return new Date().toISOString();
}
