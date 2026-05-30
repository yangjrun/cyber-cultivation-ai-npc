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
  },
  baili_delivery_run: {
    questId: "baili_delivery_run",
    title: "白璃的送药跑腿",
    description: "白璃手头紧，让你把一批回气丹送到雷罚酒馆的熟客手里。送到了回来交差，灵石现结。",
    giverNpcId: "baili",
    involvedNpcIds: ["baili", "chimu"],
    acceptableViaIntent: "give_quest",
    repeatable: true,
    cooldownHours: 48,
    completionTriggers: [
      { kind: "flag", key: "delivery_done", expectedValue: true }
    ],
    failureTriggers: [],
    effectsOnAccept: [],
    effectsOnComplete: [
      { kind: "npc_state_delta", npcId: "baili", delta: { trust: 2 } },
      { kind: "give_stones", amount: 35 }
    ],
    effectsOnFail: []
  },
  suhe_intel_errand: {
    questId: "suhe_intel_errand",
    title: "替苏鹤探口风",
    description: "苏鹤想知道黑市最近谁在低价抛屏蔽丹。你去各摊位转一圈，把听来的名字带回来。",
    giverNpcId: "suhe",
    involvedNpcIds: ["suhe", "baili"],
    acceptableViaIntent: "give_quest",
    repeatable: true,
    cooldownHours: 60,
    completionTriggers: [
      { kind: "flag", key: "intel_gathered", expectedValue: true }
    ],
    failureTriggers: [
      { kind: "npc_state_threshold", npcId: "suhe", field: "anger", op: ">=", value: 75 }
    ],
    effectsOnAccept: [],
    effectsOnComplete: [
      { kind: "npc_state_delta", npcId: "suhe", delta: { trust: 2 } },
      { kind: "give_stones", amount: 28 }
    ],
    effectsOnFail: [
      { kind: "npc_state_delta", npcId: "suhe", delta: { trust: -2 } }
    ]
  },
  chimu_toll_collection: {
    questId: "chimu_toll_collection",
    title: "替赤目跑一趟收账",
    description: "赤目懒得动，让你去管道口替他向两个欠账的散修收过路费。收齐了分你一成。",
    giverNpcId: "chimu",
    involvedNpcIds: ["chimu"],
    acceptableViaIntent: "give_quest",
    repeatable: true,
    cooldownHours: 72,
    completionTriggers: [
      { kind: "flag", key: "toll_collected", expectedValue: true }
    ],
    failureTriggers: [
      { kind: "npc_state_threshold", npcId: "chimu", field: "anger", op: ">=", value: 85 }
    ],
    effectsOnAccept: [],
    effectsOnComplete: [
      { kind: "npc_state_delta", npcId: "chimu", delta: { trust: 2, anger: -3 } },
      { kind: "give_stones", amount: 42 }
    ],
    effectsOnFail: [
      { kind: "npc_state_delta", npcId: "chimu", delta: { anger: 10 } }
    ]
  },
  qinggu_verify_rumor: {
    questId: "qinggu_verify_rumor",
    title: "替青姑验一则传言",
    description: "青姑收到一条没头脑的传言，懒得自己跑。你去核实真假，回来给她个准话，她按条结钱。",
    giverNpcId: "qinggu",
    involvedNpcIds: ["qinggu", "suhe"],
    acceptableViaIntent: "give_quest",
    repeatable: true,
    cooldownHours: 54,
    completionTriggers: [
      { kind: "flag", key: "rumor_verified", expectedValue: true }
    ],
    failureTriggers: [
      { kind: "npc_state_threshold", npcId: "qinggu", field: "trust", op: "<=", value: 0 }
    ],
    effectsOnAccept: [],
    effectsOnComplete: [
      { kind: "npc_state_delta", npcId: "qinggu", delta: { trust: 3 } },
      { kind: "give_stones", amount: 30 }
    ],
    effectsOnFail: [
      { kind: "npc_state_delta", npcId: "qinggu", delta: { trust: -2 } }
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
