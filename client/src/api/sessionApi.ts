import { fetchJsonWithRetry } from "./apiClient";
import { normalizeQuestList, type QuestProgress } from "./questApi";

export type RootElement = "metal" | "wood" | "water" | "fire" | "earth";

export type ElementRoots = Record<RootElement, number>;

export type ItemEffect =
  | { type: "restore_qi"; amount: number }
  | { type: "reduce_alert"; amount: number }
  | { type: "breakthrough_bonus"; amount: number; durationSeconds: number };

export type ItemDefinition = {
  id: string;
  name: string;
  type: "material" | "pill" | "junk";
  description: string;
  effect?: ItemEffect;
};

export type InventoryItem = {
  itemId: string;
  quantity: number;
  item: ItemDefinition | null;
};

export type PlayerState = {
  id: string;
  sessionId: string;
  name: string;
  realm: string;
  hasIllegalChip: boolean;
  visibleTraits: string[];
  recentActions: string[];
  spiritStones: number;
  qiCurrent: number;
  qiCap: number;
  cultivationStageIdx: number;
  roots: ElementRoots;
  activeTechniqueId: string;
  breakthroughBonusUntil: string | null;
  alertShieldUntil: string | null;
  alertShieldStrength: number;
};

export type NpcStateSnapshot = {
  trust: number;
  fear: number;
  anger: number;
  tianDaoAlert: number;
};

export type SessionResponse = {
  sessionId: string;
  playerId: string;
  player: PlayerState;
  npcState: NpcStateSnapshot | null;
  memories: string[];
  inventory: InventoryItem[];
  activeSceneId: string;
  npcStates: Record<string, NpcStateSnapshot>;
  quests: QuestProgress[];
};

export const defaultRoots: ElementRoots = {
  metal: 70,
  wood: 40,
  water: 12,
  fire: 8,
  earth: 16
};

export const defaultPlayer: PlayerState = {
  id: "",
  sessionId: "",
  name: "陆玄",
  realm: "练气期",
  hasIllegalChip: true,
  visibleTraits: ["右臂义体", "雷罚残痕", "非法灵根波形"],
  recentActions: ["救过白璃的药童"],
  spiritStones: 0,
  qiCurrent: 0,
  qiCap: 100,
  cultivationStageIdx: 0,
  roots: defaultRoots,
  activeTechniqueId: "basic_breathing",
  breakthroughBonusUntil: null,
  alertShieldUntil: null,
  alertShieldStrength: 0
};

export async function createSession(): Promise<SessionResponse> {
  const raw = await fetchJsonWithRetry("/api/session", { method: "POST" });
  return normalizeSessionResponse(raw);
}

export async function getSession(sessionId: string): Promise<SessionResponse> {
  const raw = await fetchJsonWithRetry(`/api/session/${encodeURIComponent(sessionId)}`);
  return normalizeSessionResponse(raw);
}

export function normalizeSessionResponse(raw: unknown): SessionResponse {
  const record = isRecord(raw) ? raw : {};
  const sessionId = normalizeString(record.sessionId);
  const playerId = normalizeString(record.playerId);
  const player = normalizePlayer(record.player, sessionId, playerId);

  return {
    sessionId: sessionId || player.sessionId,
    playerId: playerId || player.id,
    player,
    npcState: normalizeNpcState(record.npcState),
    memories: normalizeStringArray(record.memories, []),
    inventory: normalizeInventory(record.inventory),
    activeSceneId: normalizeString(record.activeSceneId) || "black_market",
    npcStates: normalizeNpcStates(record.npcStates),
    quests: normalizeQuestList({ quests: record.quests })
  };
}

function normalizeNpcStates(raw: unknown): Record<string, NpcStateSnapshot> {
  if (!isRecord(raw)) {
    return {};
  }

  const result: Record<string, NpcStateSnapshot> = {};

  for (const [key, value] of Object.entries(raw)) {
    const state = normalizeNpcState(value);

    if (state) {
      result[key] = state;
    }
  }

  return result;
}

export function normalizePlayer(raw: unknown, fallbackSessionId = "", fallbackPlayerId = ""): PlayerState {
  const record = isRecord(raw) ? raw : {};
  const qiCap = normalizeNumber(record.qiCap, defaultPlayer.qiCap);

  return {
    id: normalizeString(record.id) || fallbackPlayerId,
    sessionId: normalizeString(record.sessionId) || fallbackSessionId,
    name: normalizeString(record.name) || defaultPlayer.name,
    realm: normalizeString(record.realm) || defaultPlayer.realm,
    hasIllegalChip: typeof record.hasIllegalChip === "boolean" ? record.hasIllegalChip : defaultPlayer.hasIllegalChip,
    visibleTraits: normalizeStringArray(record.visibleTraits, defaultPlayer.visibleTraits),
    recentActions: normalizeStringArray(record.recentActions, defaultPlayer.recentActions),
    spiritStones: normalizeNumber(record.spiritStones, defaultPlayer.spiritStones),
    qiCurrent: normalizeNumber(record.qiCurrent, defaultPlayer.qiCurrent),
    qiCap,
    cultivationStageIdx: normalizeNumber(record.cultivationStageIdx, defaultPlayer.cultivationStageIdx),
    roots: normalizeRoots(record.roots),
    activeTechniqueId: normalizeString(record.activeTechniqueId) || defaultPlayer.activeTechniqueId,
    breakthroughBonusUntil: normalizeNullableString(record.breakthroughBonusUntil),
    alertShieldUntil: normalizeNullableString(record.alertShieldUntil),
    alertShieldStrength: normalizeNumber(record.alertShieldStrength, defaultPlayer.alertShieldStrength)
  };
}

export function normalizeInventory(raw: unknown): InventoryItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((entry): InventoryItem[] => {
    if (!isRecord(entry)) {
      return [];
    }

    const itemId = normalizeString(entry.itemId);
    const quantity = normalizeNumber(entry.quantity, 0);

    if (!itemId || quantity <= 0) {
      return [];
    }

    return [{ itemId, quantity, item: normalizeItemDefinition(entry.item) }];
  });
}

function normalizeItemDefinition(raw: unknown): ItemDefinition | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = normalizeString(raw.id);
  const name = normalizeString(raw.name);
  const type = normalizeString(raw.type);

  if (!id || !name || !["material", "pill", "junk"].includes(type)) {
    return null;
  }

  return {
    id,
    name,
    type: type as ItemDefinition["type"],
    description: normalizeString(raw.description),
    effect: normalizeEffect(raw.effect)
  };
}

function normalizeEffect(raw: unknown): ItemEffect | undefined {
  if (!isRecord(raw) || typeof raw.type !== "string") {
    return undefined;
  }

  if (raw.type === "restore_qi" || raw.type === "reduce_alert") {
    return { type: raw.type, amount: normalizeNumber(raw.amount, 0) };
  }

  if (raw.type === "breakthrough_bonus") {
    return {
      type: "breakthrough_bonus",
      amount: normalizeNumber(raw.amount, 0),
      durationSeconds: normalizeNumber(raw.durationSeconds, 0)
    };
  }

  return undefined;
}

function normalizeRoots(raw: unknown): ElementRoots {
  const record = isRecord(raw) ? raw : {};

  return {
    metal: normalizeNumber(record.metal, defaultRoots.metal),
    wood: normalizeNumber(record.wood, defaultRoots.wood),
    water: normalizeNumber(record.water, defaultRoots.water),
    fire: normalizeNumber(record.fire, defaultRoots.fire),
    earth: normalizeNumber(record.earth, defaultRoots.earth)
  };
}

function normalizeNpcState(value: unknown): NpcStateSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const fields: Array<keyof NpcStateSnapshot> = ["trust", "fear", "anger", "tianDaoAlert"];

  if (!fields.every((field) => typeof value[field] === "number" && Number.isFinite(value[field]))) {
    return null;
  }

  return {
    trust: value.trust as number,
    fear: value.fear as number,
    anger: value.anger as number,
    tianDaoAlert: value.tianDaoAlert as number
  };
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? [...value] : [...fallback];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
