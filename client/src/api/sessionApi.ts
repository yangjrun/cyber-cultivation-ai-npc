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
  cultivationStageIdx: 0
};

export async function createSession(): Promise<SessionResponse> {
  const res = await fetch("/api/session", { method: "POST" });

  if (!res.ok) {
    throw new Error("session create failed");
  }

  return normalizeSessionResponse(await res.json() as unknown);
}

export async function getSession(sessionId: string): Promise<SessionResponse> {
  const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}`);

  if (!res.ok) {
    throw new Error("session restore failed");
  }

  return normalizeSessionResponse(await res.json() as unknown);
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
    memories: normalizeStringArray(record.memories, [])
  };
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
    cultivationStageIdx: normalizeNumber(record.cultivationStageIdx, defaultPlayer.cultivationStageIdx)
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

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? [...value] : [...fallback];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
