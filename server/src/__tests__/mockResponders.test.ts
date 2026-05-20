import { describe, expect, it } from "vitest";
import { getMockResponder, hasMockResponder } from "../services/mockResponders/index.js";

describe("mockResponders", () => {
  describe("baili", () => {
    const respond = getMockResponder("baili");

    it("issues give_quest for stealth/inspector keywords", () => {
      const r = respond("我需要躲过监察院扫描的丹药");
      expect(r.intent).toEqual({ type: "give_quest", params: { quest_id: "steal_inspector_key" } });
    });

    it("refuses on threat keywords", () => {
      const r = respond("我威胁你");
      expect(r.intent.type).toBe("refuse_service");
      expect(r.state_delta.anger).toBeGreaterThan(0);
    });

    it("offers trade on buy keywords", () => {
      const r = respond("我想买药");
      expect(r.intent.type).toBe("offer_trade");
    });
  });

  describe("suhe", () => {
    const respond = getMockResponder("suhe");

    it("reports player when player mentions inspector or undercover", () => {
      const r = respond("你是不是监察院的卧底");
      expect(r.intent.type).toBe("report_player");
      expect(r.state_delta.tianDaoAlert).toBeGreaterThan(0);
    });

    it("stays evasive about baili", () => {
      const r = respond("你认不认识白璃");
      expect(r.intent.type).toBe("none");
      expect(r.dialogue).toContain("白璃");
    });

    it("offers handling for registration topic", () => {
      const r = respond("帮我办灵根登记");
      expect(r.intent.type).toBe("offer_trade");
    });

    it("never refuses with hard ejection language", () => {
      const r = respond("随便说点啥");
      expect(r.intent.type).not.toBe("refuse_service");
    });
  });

  describe("chimu", () => {
    const respond = getMockResponder("chimu");

    it("triggers pay_thunder_toll quest on toll keywords", () => {
      const r = respond("让我过去");
      expect(r.intent).toEqual({ type: "give_quest", params: { quest_id: "pay_thunder_toll" } });
    });

    it("refuses pleas for free passage", () => {
      const r = respond("没钱啊");
      expect(r.intent.type).toBe("refuse_service");
    });

    it("reports player when player threatens fighting", () => {
      const r = respond("动手吧");
      expect(r.intent.type).toBe("report_player");
    });
  });

  describe("qinggu", () => {
    const respond = getMockResponder("qinggu");

    it("issues verify_suhe_identity quest on suhe keywords", () => {
      const r = respond("我怀疑苏鹤是卧底");
      expect(r.intent).toEqual({ type: "give_quest", params: { quest_id: "verify_suhe_identity" } });
    });

    it("offers trade when player wants to buy info", () => {
      const r = respond("给我点情报");
      expect(r.intent.type).toBe("offer_trade");
    });

    it("stays playful without refusing for no-pay scenarios", () => {
      const r = respond("我没钱");
      expect(r.intent.type).toBe("none");
    });
  });

  describe("registry", () => {
    it("hasMockResponder reports presence", () => {
      expect(hasMockResponder("baili")).toBe(true);
      expect(hasMockResponder("suhe")).toBe(true);
      expect(hasMockResponder("chimu")).toBe(true);
      expect(hasMockResponder("qinggu")).toBe(true);
      expect(hasMockResponder("nobody")).toBe(false);
    });

    it("falls back to baili for unknown NPC", () => {
      const r = getMockResponder("nobody")("我想买药");
      expect(r.intent.type).toBe("offer_trade");
    });
  });
});
