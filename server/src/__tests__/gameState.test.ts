import { beforeEach, describe, expect, it } from "vitest";
import { applyStateDelta, executeIntent, getNpcProfile, getNpcState, resetGameState } from "../services/gameState.js";

describe("gameState", () => {
  beforeEach(() => {
    resetGameState();
  });

  it("returns the Baili profile and initial bounded state", () => {
    expect(getNpcProfile("baili").name).toBe("白璃");
    expect(getNpcState("baili")).toEqual({ trust: 20, fear: 10, anger: 0, tianDaoAlert: 45 });
  });

  it("applies state deltas immutably and clamps values to 0..100", () => {
    const original = getNpcState("baili");
    const updated = applyStateDelta("baili", { trust: 200, fear: -50, anger: 12, tianDaoAlert: 80 });

    expect(original).toEqual({ trust: 20, fear: 10, anger: 0, tianDaoAlert: 45 });
    expect(updated).toEqual({ trust: 100, fear: 0, anger: 12, tianDaoAlert: 100 });
  });

  it("executes allowed intents and returns action results", () => {
    expect(executeIntent("baili", { type: "none", params: {} })).toBe("");
    expect(executeIntent("baili", { type: "offer_trade", params: {} })).toBe("已打开黑市丹药交易。");
    expect(executeIntent("baili", { type: "give_quest", params: { quest_id: "steal_inspector_key" } })).toBe("任务已触发：偷取监察密钥。");
    expect(executeIntent("baili", { type: "refuse_service", params: {} })).toBe("白璃拒绝继续交易。");
  });

  it("raises TianDao alert when reporting the player", () => {
    const result = executeIntent("baili", { type: "report_player", params: {} });

    expect(result).toBe("白璃向监察院泄露了你的踪迹，天道警戒上升。");
    expect(getNpcState("baili").tianDaoAlert).toBe(55);
  });
});
