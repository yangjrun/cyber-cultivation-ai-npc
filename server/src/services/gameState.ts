import type { IntentType, NpcIntent, NpcProfile, NpcState, NpcStateDelta, PlayerState } from "../types/npc.js";

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

export const playerState: PlayerState = {
  name: "陆玄",
  realm: "练气期",
  hasIllegalChip: true,
  visibleTraits: ["右臂义体", "雷罚残痕", "非法灵根波形"],
  recentActions: ["救过白璃的药童"]
};

const scopedNpcSeparator = "::";

let currentNpcStates: Record<string, NpcState> = cloneStates(initialNpcStates);

function cloneStates(states: Record<string, NpcState>): Record<string, NpcState> {
  return Object.fromEntries(Object.entries(states).map(([npcId, state]) => [npcId, { ...state }]));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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
  const state = currentNpcStates[npcId];

  if (state) {
    return { ...state };
  }

  const baseNpcId = getBaseNpcId(npcId);
  const initialState = initialNpcStates[baseNpcId];

  if (!initialState) {
    throw new Error(`Unknown NPC: ${npcId}`);
  }

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

  currentNpcStates = {
    ...currentNpcStates,
    [npcId]: nextState
  };

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
  const baseNpcId = getBaseNpcId(npcId);
  const initialState = initialNpcStates[baseNpcId];

  if (!initialState) {
    throw new Error(`Unknown NPC: ${npcId}`);
  }

  currentNpcStates = {
    ...currentNpcStates,
    [npcId]: { ...initialState }
  };

  return { ...initialState };
}

export function resetGameState(): void {
  currentNpcStates = cloneStates(initialNpcStates);
}

function getBaseNpcId(npcId: string): string {
  const [, baseNpcId] = npcId.split(scopedNpcSeparator);
  return baseNpcId || npcId;
}
