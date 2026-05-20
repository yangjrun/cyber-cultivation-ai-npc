import { getDb } from "../db/connection.js";
import { sessionExists } from "./playerStore.js";
import type { IntentType, NpcIntent, NpcProfile, NpcState, NpcStateDelta } from "../types/npc.js";

export const allowedIntents = ["none", "offer_trade", "give_quest", "report_player", "refuse_service"] as const satisfies readonly IntentType[];

export const npcProfiles: Record<string, NpcProfile> = {
  baili: {
    npc_id: "baili",
    name: "白璃",
    role: "黑市炼丹师",
    faction: "无相黑市",
    personality: ["谨慎", "毒舌", "务实", "重视等价交换"],
    speaking_style: "短句、冷淡、带讽刺，讨厌废话",
    goal: "研究屏蔽天道云追踪的丹药，并攒够资源离开九龙下城",
    secret: "她的师父被太清监察院抓走",
    knowledge_scope: ["黑市丹药", "非法灵根芯片", "太清监察院巡逻规律", "九龙下城传闻"],
    cannot_know: ["最终Boss身份", "天道云核心真相", "玩家未来选择"]
  }
};

const initialNpcStates: Record<string, NpcState> = {
  baili: {
    trust: 20,
    fear: 10,
    anger: 0,
    tianDaoAlert: 45
  }
};

const scopedNpcSeparator = "::";

type NpcStateRow = {
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

  return {
    ...profile,
    personality: [...profile.personality],
    knowledge_scope: [...profile.knowledge_scope],
    cannot_know: [...profile.cannot_know]
  };
}

export function getNpcState(npcId: string): NpcState {
  const row = getDb()
    .prepare("SELECT trust, fear, anger, tian_dao_alert FROM npc_states WHERE scoped_npc_id = ?")
    .get(npcId) as NpcStateRow | undefined;

  if (row) {
    return mapState(row);
  }

  const initialState = getInitialState(npcId);
  persistNpcState(npcId, initialState);

  return { ...initialState };
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
  const initialState = initialNpcStates[baseNpcId];

  if (!initialState) {
    throw new Error(`Unknown NPC: ${npcId}`);
  }

  return { ...initialState };
}

function mapState(row: NpcStateRow): NpcState {
  return {
    trust: row.trust,
    fear: row.fear,
    anger: row.anger,
    tianDaoAlert: row.tian_dao_alert
  };
}

function getPersistableSessionId(npcId: string): string | null {
  const [sessionId] = npcId.split(scopedNpcSeparator);
  return npcId.includes(scopedNpcSeparator) && sessionExists(sessionId) ? sessionId : null;
}

function getBaseNpcId(npcId: string): string {
  const [, baseNpcId] = npcId.split(scopedNpcSeparator);
  return baseNpcId || npcId;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
