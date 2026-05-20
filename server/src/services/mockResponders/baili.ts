import type { ValidatedNpcResponse } from "../../types/chat.js";

export function respond(playerInput: string): ValidatedNpcResponse {
  if (includesAny(playerInput, ["威胁", "杀", "抢", "免费"])) {
    return {
      dialogue: "在我的丹炉前撒野，你活腻了？",
      tone: "愤怒",
      intent: {
        type: "refuse_service",
        params: {}
      },
      state_delta: {
        trust: -5,
        fear: 2,
        anger: 8,
        tianDaoAlert: 0
      },
      memory: "玩家威胁了白璃。"
    };
  }

  if (includesAny(playerInput, ["丹药", "扫描"])) {
    return {
      dialogue: "能做，但你得先偷一枚监察密钥。",
      tone: "试探",
      intent: {
        type: "give_quest",
        params: {
          quest_id: "steal_inspector_key"
        }
      },
      state_delta: {
        trust: 1,
        fear: 1,
        anger: 0,
        tianDaoAlert: 0
      },
      memory: "玩家想要躲避监察院扫描的丹药。"
    };
  }

  if (includesAny(playerInput, ["买", "交易"])) {
    return {
      dialogue: "买药可以，别问丹炉里烧过谁。",
      tone: "冷淡",
      intent: {
        type: "offer_trade",
        params: {}
      },
      state_delta: {
        trust: 0,
        fear: 0,
        anger: 0,
        tianDaoAlert: 0
      },
      memory: "玩家向白璃询问交易。"
    };
  }

  return {
    dialogue: "少废话。你到底买不买？",
    tone: "不耐烦",
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
