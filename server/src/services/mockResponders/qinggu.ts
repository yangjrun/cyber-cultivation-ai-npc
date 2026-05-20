import type { ValidatedNpcResponse } from "../../types/chat.js";

export function respond(playerInput: string): ValidatedNpcResponse {
  if (includesAny(playerInput, ["苏鹤", "卧底", "鹤七"])) {
    return {
      dialogue: "你不去验一验？姑奶奶帮你引路。",
      tone: "勾人",
      intent: {
        type: "give_quest",
        params: {
          quest_id: "verify_suhe_identity"
        }
      },
      state_delta: {
        trust: 2,
        fear: 0,
        anger: 0,
        tianDaoAlert: 0
      },
      memory: "玩家怀疑苏鹤的身份，青姑顺势卖了线索。"
    };
  }

  if (includesAny(playerInput, ["买", "灵石", "情报", "信息", "打听"])) {
    return {
      dialogue: "这名字值多少灵石？小郎君。",
      tone: "玩味",
      intent: {
        type: "offer_trade",
        params: {}
      },
      state_delta: {
        trust: 1,
        fear: 0,
        anger: 0,
        tianDaoAlert: 0
      },
      memory: "玩家在向青姑讨价还价。"
    };
  }

  if (includesAny(playerInput, ["威胁", "杀", "动手"])) {
    return {
      dialogue: "动手？姑奶奶喊一嗓子，雷罚帮就上。",
      tone: "玩味",
      intent: {
        type: "refuse_service",
        params: {}
      },
      state_delta: {
        trust: -3,
        fear: 1,
        anger: 5,
        tianDaoAlert: 2
      },
      memory: "玩家对青姑动了杀意。"
    };
  }

  if (includesAny(playerInput, ["没钱", "免费", "白拿"])) {
    return {
      dialogue: "没灵石？那就先听个开头。",
      tone: "轻佻",
      intent: {
        type: "none",
        params: {}
      },
      state_delta: {
        trust: 0,
        fear: 0,
        anger: 0,
        tianDaoAlert: 0
      },
      memory: "玩家想白嫖一句青姑的情报。"
    };
  }

  return {
    dialogue: "姑奶奶只帮自己，小郎君。",
    tone: "玩味",
    intent: {
      type: "none",
      params: {}
    },
    state_delta: {
      trust: 0,
      fear: 0,
      anger: 0,
      tianDaoAlert: 0
    },
    memory: ""
  };
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}
