import type { ValidatedNpcResponse } from "../../types/chat.js";

export function respond(playerInput: string): ValidatedNpcResponse {
  if (includesAny(playerInput, ["监察院", "卧底", "鹤七"])) {
    return {
      dialogue: "这话从何说起？苏某不过帮人跑跑手续。",
      tone: "客气",
      intent: {
        type: "report_player",
        params: {}
      },
      state_delta: {
        trust: -2,
        fear: 0,
        anger: 3,
        tianDaoAlert: 5
      },
      memory: "玩家提到了监察院或卧底。"
    };
  }

  if (includesAny(playerInput, ["非法", "芯片", "走私", "违规"])) {
    return {
      dialogue: "苏某眼神不好，没看见。",
      tone: "含蓄",
      intent: {
        type: "report_player",
        params: {}
      },
      state_delta: {
        trust: 0,
        fear: 0,
        anger: 0,
        tianDaoAlert: 8
      },
      memory: "玩家暗示自己有违规之物。"
    };
  }

  if (includesAny(playerInput, ["登记", "手续", "灵根登记"])) {
    return {
      dialogue: "登记一事，苏某可以代劳。",
      tone: "平静",
      intent: {
        type: "offer_trade",
        params: { itemId: "cloud_veil_pill" }
      },
      state_delta: {
        trust: 1,
        fear: 0,
        anger: 0,
        tianDaoAlert: 0
      },
      memory: "玩家询问了灵根登记。"
    };
  }

  if (includesAny(playerInput, ["白璃", "黑市", "丹炉"])) {
    return {
      dialogue: "白璃姑娘？恐怕这位道友还有别的去处吧。",
      tone: "含蓄",
      intent: {
        type: "none",
        params: {}
      },
      state_delta: {
        trust: 0,
        fear: 0,
        anger: 0,
        tianDaoAlert: 3
      },
      memory: "玩家提到了白璃。"
    };
  }

  return {
    dialogue: "道友说得隐晦，苏某听不太明白。",
    tone: "客气",
    intent: {
      type: "none",
      params: {}
    },
    state_delta: {
      trust: 0,
      fear: 0,
      anger: 0,
      tianDaoAlert: 1
    },
    memory: ""
  };
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}
