import { fetchJsonWithRetry } from "./apiClient";
import { normalizePlayer, type InventoryItem, type NpcStateSnapshot, type PlayerState } from "./sessionApi";

export type CultivateResponse = {
  player: PlayerState;
  qiGained: number;
  durationAccepted: number;
  message: string;
};

export type BreakthroughResponse = {
  success: boolean;
  player: PlayerState;
  npcState: NpcStateSnapshot | null;
  stageLabel: string;
  successRate: number;
  riskLevel: "low" | "medium" | "high";
  message: string;
};

export async function cultivate(sessionId: string, duration: number): Promise<CultivateResponse> {
  const raw = await fetchJsonWithRetry("/api/cultivate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, duration })
  });

  return normalizeCultivateResponse(raw);
}

export async function breakthrough(sessionId: string): Promise<BreakthroughResponse> {
  const raw = await fetchJsonWithRetry("/api/breakthrough", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId })
  });

  return normalizeBreakthroughResponse(raw);
}

function normalizeCultivateResponse(raw: unknown): CultivateResponse {
  const record = isRecord(raw) ? raw : {};

  return {
    player: normalizePlayer(record.player),
    qiGained: normalizeNumber(record.qiGained, 0),
    durationAccepted: normalizeNumber(record.durationAccepted, 0),
    message: normalizeString(record.message)
  };
}

function normalizeBreakthroughResponse(raw: unknown): BreakthroughResponse {
  const record = isRecord(raw) ? raw : {};

  return {
    success: record.success === true,
    player: normalizePlayer(record.player),
    npcState: normalizeNpcState(record.npcState),
    stageLabel: normalizeString(record.stageLabel),
    successRate: normalizeNumber(record.successRate, 0),
    riskLevel: normalizeRisk(record.riskLevel),
    message: normalizeString(record.message)
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

function normalizeRisk(value: unknown): BreakthroughResponse["riskLevel"] {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type { InventoryItem };
