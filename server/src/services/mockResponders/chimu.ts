import type { ValidatedNpcResponse } from "../../types/chat.js";

export function respond(playerInput: string): ValidatedNpcResponse {
  if (includesAny(playerInput, ["让我过", "过路", "让路", "借过"])) {
    return {
      dialogue: "过路费，三十灵石。",
      tone: "不耐烦",
      intent: {
        type: "give_quest",
        params: {
          quest_id: "pay_thunder_toll"
        }
      },
      state_delta: {
        trust: 0,
        fear: 0,
        anger: 0,
        tianDaoAlert: 0
      },
      memory: "玩家试图通过赤目的卡口。"
    };
  }

  if (includesAny(playerInput, ["没钱", "求情", "穷", "通融", "免费"])) {
    return {
      dialogue: "没钱？那就扣家伙。",
      tone: "冷笑",
      intent: {
        type: "refuse_service",
        params: {}
      },
      state_delta: {
        trust: -3,
        fear: 0,
        anger: 6,
        tianDaoAlert: 0
      },
      memory: "玩家试图赖过路费。"
    };
  }

  if (includesAny(playerInput, ["动手", "打架", "上"])) {
    return {
      dialogue: "你右臂的玩意儿藏不住。",
      tone: "挑衅",
      intent: {
        type: "report_player",
        params: {}
      },
      state_delta: {
        trust: -2,
        fear: 0,
        anger: 8,
        tianDaoAlert: 6
      },
      memory: "玩家想动手，赤目的义体眼看穿了非法灵根。"
    };
  }

  if (includesAny(playerInput, ["白璃", "黑市"])) {
    return {
      dialogue: "白璃？她也得交。",
      tone: "嘲讽",
      intent: {
        type: "none",
        params: {}
      },
      state_delta: {
        trust: 0,
        fear: 0,
        anger: 1,
        tianDaoAlert: 0
      },
      memory: "玩家提到了白璃。"
    };
  }

  return {
    dialogue: "雷罚帮不收散修。",
    tone: "平静",
    intent: {
      type: "none",
      params: {}
    },
    state_delta: {
      trust: 0,
      fear: 0,
      anger: 1,
      tianDaoAlert: 0
    },
    memory: ""
  };
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}
