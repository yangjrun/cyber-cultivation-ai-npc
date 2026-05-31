import { getItemDefinition } from "../data/items.js";
import { getSeedStock } from "../data/npcShops.js";
import { npcProfiles as npcProfilesData } from "../data/npcs.js";
import { getDb } from "../db/connection.js";
import { addItem } from "./inventoryStore.js";
import { getPlayer, sessionExists, updatePlayer } from "./playerStore.js";
import { parseScopedNpcId, scopedNpcId, SCOPED_NPC_SEPARATOR } from "./scopedNpcId.js";
import { computeBuyUnitPrice, isTradeRefused } from "./tradeEngine.js";
import { adjustShopBalance, adjustShopStock, getShopItemQuantity } from "./tradeStore.js";
import type { IntentType, NpcIntent, NpcProfile, NpcState, NpcStateDelta } from "../types/npc.js";

export const allowedIntents = ["none", "offer_trade", "complete_trade", "teach_technique", "give_quest", "complete_quest_objective", "report_player", "refuse_service"] as const satisfies readonly IntentType[];

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
  const name = getNpcDisplayName(npcId);

  if (intent.type === "offer_trade") {
    return `${name}打开了对应的交易。`;
  }

  if (intent.type === "complete_trade") {
    const { sessionId, baseNpcId } = parseScopedNpcId(npcId);
    const tradeParams = intent.params as { itemId?: unknown; quantity?: unknown };

    if (!sessionId) {
      return "交易上下文丢失，无法结算。";
    }

    const player = getPlayer(sessionId);

    if (!player) {
      return "玩家存档异常，无法结算。";
    }

    const itemId = typeof tradeParams.itemId === "string" ? tradeParams.itemId : "";
    const quantity = typeof tradeParams.quantity === "number" && Number.isFinite(tradeParams.quantity)
      ? Math.min(99, Math.max(1, Math.trunc(tradeParams.quantity)))
      : 1;

    const definition = getItemDefinition(itemId);

    if (!definition) {
      return `${name}的报价含糊，没指向明确的货物。`;
    }

    const npcState = getNpcState(npcId);
    const refusal = isTradeRefused({ trust: npcState.trust, fear: npcState.fear, anger: npcState.anger });

    if (refusal.refused) {
      return `${name}脸色一沉，这笔生意不做了。`;
    }

    const shopQuantity = getShopItemQuantity(sessionId, baseNpcId, itemId);

    if (shopQuantity < quantity) {
      return `${name}翻了翻手头，那个货不够。`;
    }

    const unitPrice = computeBuyUnitPrice({
      basePrice: definition.basePrice,
      npcMood: { trust: npcState.trust, fear: npcState.fear, anger: npcState.anger },
      npcStock: shopQuantity,
      referenceStock: getSeedStock(baseNpcId, itemId),
      cultivationStageIdx: player.cultivationStageIdx
    });
    const totalPrice = unitPrice * quantity;

    if (player.spiritStones < totalPrice) {
      return `${name}嗤了一声——你灵石不够，差 ${totalPrice - player.spiritStones} 枚。`;
    }

    try {
      getDb().transaction(() => {
        adjustShopStock(sessionId, baseNpcId, itemId, -quantity);
        adjustShopBalance(sessionId, baseNpcId, totalPrice);
        addItem(sessionId, itemId, quantity);
        updatePlayer(sessionId, { spiritStones: player.spiritStones - totalPrice });
        applyStateDelta(npcId, { trust: 1, fear: 0, anger: 0, tianDaoAlert: 0 });
      })();

      return `${name}与你达成了交易：${definition.name} ×${quantity}，共 ${totalPrice} 灵石。`;
    } catch {
      return `结算时灵脉波动，${name}摆了摆手——交易作废。`;
    }
  }

  if (intent.type === "teach_technique") {
    return `${name}提到一门吐纳法，但真正领悟还得靠修炼系统。`;
  }

  if (intent.type === "report_player") {
    applyStateDelta(npcId, { trust: 0, fear: 0, anger: 0, tianDaoAlert: 10 });
    return `${name}向监察院泄露了你的踪迹，天道警戒上升。`;
  }

  if (intent.type === "refuse_service") {
    return `${name}拒绝继续交易。`;
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

function getNpcDisplayName(npcId: string): string {
  const baseNpcId = getBaseNpcId(npcId);
  return npcProfiles[baseNpcId]?.name ?? "NPC";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
