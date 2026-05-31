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

  if (includesAny(playerInput, ["送货", "跑腿", "送药", "帮忙", "活", "任务"])) {
    return {
      dialogue: "替我走趟货。送到雷罚酒馆，见影骨符，递丹子。",
      tone: "冷淡",
      intent: {
        type: "give_quest",
        params: {
          quest_id: "baili_delivery_run"
        }
      },
      state_delta: {
        trust: 0,
        fear: 0,
        anger: 0,
        tianDaoAlert: 0
      },
      memory: "玩家接了送货任务。"
    };
  }

  if (includesAny(playerInput, ["丹药", "扫描", "望气"])) {
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
      memory: "玩家想要躲避监察院望气的丹药。"
    };
  }

  if (includesAny(playerInput, ["买", "交易", "来点", "卖", "灵石"])) {
    const itemId = includesAny(playerInput, ["影髓草", "材料"]) ? "shadow_herb"
      : includesAny(playerInput, ["劫灰盐"]) ? "ash_salt"
      : includesAny(playerInput, ["遮云丹", "遮云"]) ? "cloud_veil_pill"
      : includesAny(playerInput, ["破境丹", "破境"]) ? "breakthrough_pill"
      : "cheap_qi_pill";
    return {
      dialogue: "买药可以，别问丹炉里烧过谁。",
      tone: "冷淡",
      intent: {
        type: "offer_trade",
        params: { itemId }
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

  if (includesAny(playerInput, ["给你", "成交", "接着"])) {
    return {
      dialogue: "灵石点清了。货拿去，别沾火星。",
      tone: "冷淡",
      intent: {
        type: "complete_trade",
        params: { itemId: "cheap_qi_pill" }
      },
      state_delta: {
        trust: 1,
        fear: 0,
        anger: -1,
        tianDaoAlert: 0
      },
      memory: "交易完成。"
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
