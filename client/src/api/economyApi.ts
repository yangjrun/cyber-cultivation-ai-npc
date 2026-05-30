import { fetchJsonWithRetry } from "./apiClient";
import { normalizePlayer, type PlayerState } from "./sessionApi";

export type PassiveIncomeResponse = {
  claimed: boolean;
  amount: number;
  daysAccrued: number;
  message: string;
  player: PlayerState;
};

export async function claimPassiveIncome(sessionId: string): Promise<PassiveIncomeResponse> {
  const raw = await fetchJsonWithRetry("/api/economy/passive-income/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId })
  });

  return normalizePassiveIncome(raw);
}

function normalizePassiveIncome(raw: unknown): PassiveIncomeResponse {
  const record = isRecord(raw) ? raw : {};

  return {
    claimed: record.claimed === true,
    amount: typeof record.amount === "number" && Number.isFinite(record.amount) ? record.amount : 0,
    daysAccrued: typeof record.daysAccrued === "number" && Number.isFinite(record.daysAccrued) ? record.daysAccrued : 0,
    message: typeof record.message === "string" ? record.message : "",
    player: normalizePlayer(record.player)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
