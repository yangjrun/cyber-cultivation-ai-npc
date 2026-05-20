import type { QuestDefinition } from "../types/quest.js";

export const questDefinitions: Record<string, QuestDefinition> = {
  steal_inspector_key: {
    questId: "steal_inspector_key",
    title: "偷一枚监察密钥",
    description: "白璃要一枚监察院的访客密钥，用来比对屏蔽丹的配方权限。要么从监察院外围摸一枚，要么找信息贩子打听门路。",
    giverNpcId: "baili",
    involvedNpcIds: ["baili", "suhe", "qinggu"],
    acceptableViaIntent: "give_quest",
    completionTriggers: [
      { kind: "flag", key: "inspector_key_obtained", expectedValue: true }
    ],
    failureTriggers: [
      { kind: "npc_state_threshold", npcId: "suhe", field: "anger", op: ">=", value: 70 }
    ],
    effectsOnAccept: [
      { kind: "npc_state_delta", npcId: "baili", delta: { trust: 2 } }
    ],
    effectsOnComplete: [
      { kind: "npc_state_delta", npcId: "baili", delta: { trust: 8 } },
      { kind: "give_item", itemId: "cloud_veil_pill", quantity: 1 },
      { kind: "give_stones", amount: 50 }
    ],
    effectsOnFail: [
      { kind: "npc_state_delta", npcId: "baili", delta: { trust: -5 } },
      { kind: "npc_state_delta", npcId: "suhe", delta: { tianDaoAlert: 10 } }
    ]
  },
  verify_suhe_identity: {
    questId: "verify_suhe_identity",
    title: "印证苏鹤的身份",
    description: "青姑透露苏鹤可能是监察院的卧底。回去找他套套话，看他面对挑衅会不会露馅。",
    giverNpcId: "qinggu",
    involvedNpcIds: ["qinggu", "suhe"],
    acceptableViaIntent: "give_quest",
    completionTriggers: [
      { kind: "npc_state_threshold", npcId: "suhe", field: "anger", op: ">=", value: 50 }
    ],
    failureTriggers: [
      { kind: "npc_state_threshold", npcId: "qinggu", field: "trust", op: "<=", value: 0 }
    ],
    effectsOnAccept: [
      { kind: "set_flag", key: "qinggu_intel_tipped", value: true }
    ],
    effectsOnComplete: [
      { kind: "npc_state_delta", npcId: "qinggu", delta: { trust: 5 } },
      { kind: "relation_delta", from: "qinggu", to: "suhe", trust: -10, hostility: 5 },
      { kind: "give_stones", amount: 30 }
    ],
    effectsOnFail: [
      { kind: "npc_state_delta", npcId: "qinggu", delta: { trust: -3 } }
    ]
  },
  pay_thunder_toll: {
    questId: "pay_thunder_toll",
    title: "应付雷罚帮过路费",
    description: "赤目挡了你的路，要收过路费。掏灵石、求情、还是动手——他会用左眼盯着记账。",
    giverNpcId: "chimu",
    involvedNpcIds: ["chimu"],
    acceptableViaIntent: "give_quest",
    completionTriggers: [
      { kind: "flag", key: "toll_paid", expectedValue: true }
    ],
    failureTriggers: [
      { kind: "npc_state_threshold", npcId: "chimu", field: "anger", op: ">=", value: 80 }
    ],
    effectsOnAccept: [],
    effectsOnComplete: [
      { kind: "npc_state_delta", npcId: "chimu", delta: { anger: -10, trust: 3 } }
    ],
    effectsOnFail: [
      { kind: "npc_state_delta", npcId: "chimu", delta: { anger: 15, tianDaoAlert: 5 } },
      { kind: "relation_delta", from: "chimu", to: "baili", trust: -5, hostility: 5 }
    ]
  }
};

export function getQuestDefinition(questId: string): QuestDefinition | null {
  return questDefinitions[questId] ?? null;
}

export function listQuestIds(): string[] {
  return Object.keys(questDefinitions);
}

export function getQuestsByGiver(npcId: string): QuestDefinition[] {
  return Object.values(questDefinitions).filter((quest) => quest.giverNpcId === npcId);
}
