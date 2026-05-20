import { npcProfiles as npcProfilesData } from "../data/npcs.js";
import { getDb } from "../db/connection.js";
import { sessionExists } from "./playerStore.js";
import { parseScopedNpcId, scopedNpcId, SCOPED_NPC_SEPARATOR } from "./scopedNpcId.js";
import type { IntentType, NpcIntent, NpcProfile, NpcState, NpcStateDelta } from "../types/npc.js";

export const allowedIntents = ["none", "offer_trade", "complete_trade", "teach_technique", "give_quest", "report_player", "refuse_service"] as const satisfies readonly IntentType[];

export const npcProfiles: Record<string, NpcProfile> = npcProfilesData;

type NpcStateRow = {
  scoped_npc_id: string;
  base_npc_id: string;
  trust: number;
  fear: number;
  anger: number;
  tian_dao_alert: number;
};

export function getNpcProfile(npcId: string): NpcProfile {
  const profile = npcProfiles[npcId];

  if (!profile) {
    throw new Error(`Unknown NPC: ${npcId}`);
  }

  return cloneProfile(profile);
}

export function listKnownNpcIds(): string[] {
  return Object.keys(npcProfiles);
}

export function getNpcState(npcId: string): NpcState {
  const row = getDb()
    .prepare("SELECT trust, fear, anger, tian_dao_alert FROM npc_states WHERE scoped_npc_id = ?")
    .get(npcId) as Omit<NpcStateRow, "scoped_npc_id" | "base_npc_id"> | undefined;

  if (row) {
    return mapState(row);
  }

  const initialState = getInitialState(npcId);
  persistNpcState(npcId, initialState);

  return { ...initialState };
}

export function getAllNpcStatesForSession(sessionId: string): Record<string, NpcState> {
  const result: Record<string, NpcState> = {};

  for (const npcId of listKnownNpcIds()) {
    result[npcId] = getNpcState(scopedNpcId(sessionId, npcId));
  }

  return result;
}

export function applyStateDelta(npcId: string, delta: NpcStateDelta): NpcState {
  const current = getNpcState(npcId);
  const nextState: NpcState = {
    trust: clamp(current.trust + delta.trust, 0, 100),
    fear: clamp(current.fear + delta.fear, 0, 100),
    anger: clamp(current.anger + delta.anger, 0, 100),
    tianDaoAlert: clamp(current.tianDaoAlert + delta.tianDaoAlert, 0, 100)
  };

  persistNpcState(npcId, nextState);

  return { ...nextState };
}

export function executeIntent(npcId: string, intent: NpcIntent): string {
  if (intent.type === "offer_trade") {
    return "已打开黑市丹药交易。";
  }

  if (intent.type === "complete_trade") {
    return "交易已记录，具体物品以背包结算为准。";
  }

  if (intent.type === "teach_technique") {
    return "白璃提到一门吐纳法，但真正领悟还得靠修炼系统。";
  }

  if (intent.type === "give_quest" && intent.params.quest_id === "steal_inspector_key") {
    return "任务已触发：偷取监察密钥。";
  }

  if (intent.type === "report_player") {
    applyStateDelta(npcId, { trust: 0, fear: 0, anger: 0, tianDaoAlert: 10 });
    return "白璃向监察院泄露了你的踪迹，天道警戒上升。";
  }

  if (intent.type === "refuse_service") {
    return "白璃拒绝继续交易。";
  }

  return "";
}

export function resetNpcState(npcId: string): NpcState {
  const initialState = getInitialState(npcId);
  persistNpcState(npcId, initialState);

  return { ...initialState };
}

export function resetGameState(): void {
  getDb().prepare("DELETE FROM npc_states").run();
}

function persistNpcState(npcId: string, state: NpcState): void {
  const baseNpcId = getBaseNpcId(npcId);
  const sessionId = getPersistableSessionId(npcId);

  getDb()
    .prepare(
      `INSERT INTO npc_states (
        scoped_npc_id, base_npc_id, session_id, trust, fear, anger, tian_dao_alert, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(scoped_npc_id) DO UPDATE SET
        base_npc_id = excluded.base_npc_id,
        session_id = excluded.session_id,
        trust = excluded.trust,
        fear = excluded.fear,
        anger = excluded.anger,
        tian_dao_alert = excluded.tian_dao_alert,
        updated_at = excluded.updated_at`
    )
    .run(npcId, baseNpcId, sessionId, state.trust, state.fear, state.anger, state.tianDaoAlert, new Date().toISOString());
}

function getInitialState(npcId: string): NpcState {
  const baseNpcId = getBaseNpcId(npcId);
  const profile = npcProfiles[baseNpcId];

  if (!profile) {
    throw new Error(`Unknown NPC: ${npcId}`);
  }

  return { ...profile.initialState };
}

function mapState(row: Omit<NpcStateRow, "scoped_npc_id" | "base_npc_id">): NpcState {
  return {
    trust: row.trust,
    fear: row.fear,
    anger: row.anger,
    tianDaoAlert: row.tian_dao_alert
  };
}

function getPersistableSessionId(npcId: string): string | null {
  const { sessionId } = parseScopedNpcId(npcId);
  return sessionId && sessionExists(sessionId) ? sessionId : null;
}

function getBaseNpcId(npcId: string): string {
  if (!npcId.includes(SCOPED_NPC_SEPARATOR)) {
    return npcId;
  }

  return parseScopedNpcId(npcId).baseNpcId;
}

function cloneProfile(profile: NpcProfile): NpcProfile {
  return {
    ...profile,
    personality: [...profile.personality],
    knowledge_scope: [...profile.knowledge_scope],
    cannot_know: [...profile.cannot_know],
    sceneIds: [...profile.sceneIds],
    initialState: { ...profile.initialState }
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
