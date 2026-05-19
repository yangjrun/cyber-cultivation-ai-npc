import { describe, expect, it } from "vitest";
import { validateLlmResponse } from "../services/responseValidator.js";

const longDialogue = "这是一个非常非常非常非常非常非常非常非常非常非常长的白璃回复不该完整出现也不能继续解释更多背景";

describe("responseValidator", () => {
  it("extracts the first JSON object from noisy model output", () => {
    const result = validateLlmResponse(`模型废话\n\`\`\`json\n{
      "dialogue": "少问，先付灵石。",
      "tone": "冷淡",
      "intent": { "type": "offer_trade", "params": {} },
      "state_delta": { "trust": 1, "fear": 0, "anger": 0, "tianDaoAlert": 0 },
      "memory": "玩家询问交易。"
    }\n\`\`\``);

    expect(result.dialogue).toBe("少问，先付灵石。");
    expect(result.intent.type).toBe("offer_trade");
    expect(result.memory).toBe("玩家询问交易。");
  });

  it("uses the fallback response when JSON parsing fails", () => {
    const result = validateLlmResponse("not json at all");

    expect(result).toEqual({
      dialogue: "少废话。你到底买不买？",
      tone: "不耐烦",
      intent: { type: "none", params: {} },
      state_delta: { trust: 0, fear: 0, anger: 0, tianDaoAlert: 0 },
      memory: ""
    });
  });

  it("normalizes dialogue and truncates overlong text", () => {
    const result = validateLlmResponse(JSON.stringify({
      dialogue: ` \"${longDialogue}\"\n`,
      tone: "试探",
      intent: { type: "none", params: {} },
      state_delta: { trust: 0, fear: 0, anger: 0, tianDaoAlert: 0 },
      memory: ""
    }));

    expect(Array.from(result.dialogue).length).toBe(41);
    expect(result.dialogue.endsWith("…")).toBe(true);
    expect(result.dialogue).not.toContain("\n");
    expect(result.dialogue).not.toContain("\"");
  });

  it("rejects unsupported intents", () => {
    const result = validateLlmResponse(JSON.stringify({
      dialogue: "别乱试探我。",
      tone: "警惕",
      intent: { type: "summon_artifact", params: { artifact: "不存在的神器" } },
      state_delta: { trust: 0, fear: 0, anger: 0, tianDaoAlert: 0 },
      memory: ""
    }));

    expect(result.intent).toEqual({ type: "none", params: {} });
  });

  it("allows only the steal_inspector_key quest", () => {
    const invalidQuest = validateLlmResponse(JSON.stringify({
      dialogue: "这活我不接。",
      tone: "冷淡",
      intent: { type: "give_quest", params: { quest_id: "invent_new_relic" } },
      state_delta: { trust: 0, fear: 0, anger: 0, tianDaoAlert: 0 },
      memory: ""
    }));
    const validQuest = validateLlmResponse(JSON.stringify({
      dialogue: "先偷监察密钥。",
      tone: "试探",
      intent: { type: "give_quest", params: { quest_id: "steal_inspector_key" } },
      state_delta: { trust: 0, fear: 0, anger: 0, tianDaoAlert: 0 },
      memory: ""
    }));

    expect(invalidQuest.intent).toEqual({ type: "none", params: {} });
    expect(validQuest.intent).toEqual({ type: "give_quest", params: { quest_id: "steal_inspector_key" } });
  });

  it("strips params for intents that do not need them", () => {
    const result = validateLlmResponse(JSON.stringify({
      dialogue: "药可以卖。",
      tone: "冷淡",
      intent: { type: "offer_trade", params: { injected: "unexpected" } },
      state_delta: { trust: 0, fear: 0, anger: 0, tianDaoAlert: 0 },
      memory: ""
    }));

    expect(result.intent).toEqual({ type: "offer_trade", params: {} });
  });

  it("clamps state deltas and truncates memory", () => {
    const result = validateLlmResponse(JSON.stringify({
      dialogue: "规矩懂吗？",
      tone: 123,
      intent: { type: "none", params: {} },
      state_delta: { trust: 99, fear: -99, anger: "bad", tianDaoAlert: 7 },
      memory: "玩家说了很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多内容。"
    }));

    expect(result.tone).toBe("不耐烦");
    expect(result.state_delta).toEqual({ trust: 10, fear: -10, anger: 0, tianDaoAlert: 7 });
    expect(Array.from(result.memory).length).toBeLessThanOrEqual(60);
  });
});
