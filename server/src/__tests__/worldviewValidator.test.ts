import { describe, expect, it } from "vitest";
import { validateWorldview } from "../services/worldviewValidator.js";
import type { ValidatedNpcResponse } from "../types/chat.js";

function makeResponse(overrides: Partial<ValidatedNpcResponse> = {}): ValidatedNpcResponse {
  return {
    dialogue: "",
    tone: "",
    intent: { type: "none", params: {} },
    state_delta: { trust: 0, fear: 0, anger: 0, tianDaoAlert: 0 },
    memory: "",
    actions: [],
    ...overrides
  };
}

describe("worldviewValidator", () => {
  it("passes clean dialogue through unchanged", () => {
    const result = validateWorldview(makeResponse({ dialogue: "过路费，三十灵石。" }));

    expect(result.violations).toEqual([]);
    expect(result.hasHardViolation).toBe(false);
    expect(result.sanitized.dialogue).toBe("过路费，三十灵石。");
  });

  it("replaces single soft violation in dialogue", () => {
    const result = validateWorldview(makeResponse({ dialogue: "交钱。" }));

    expect(result.violations).toEqual([{ term: "钱", severity: "soft" }]);
    expect(result.hasHardViolation).toBe(false);
    expect(result.sanitized.dialogue).toBe("交灵石。");
  });

  it("replaces multiple soft violations in same dialogue", () => {
    const result = validateWorldview(
      makeResponse({ dialogue: "扫描你的芯片，再交钱。" })
    );

    const terms = result.violations.map((v) => v.term).sort();
    expect(terms).toEqual(["扫描", "芯片", "钱"]);
    expect(result.hasHardViolation).toBe(false);
    expect(result.sanitized.dialogue).toBe("望气你的灵根烙印，再交灵石。");
  });

  it("flags hard violation without replacement", () => {
    const result = validateWorldview(makeResponse({ dialogue: "这是赛博空间。" }));

    expect(result.violations).toEqual([{ term: "赛博", severity: "hard" }]);
    expect(result.hasHardViolation).toBe(true);
    expect(result.sanitized.dialogue).toBe("这是赛博空间。");
  });

  it("flags hard violation when mixed with soft violation", () => {
    const result = validateWorldview(
      makeResponse({ dialogue: "扫描数据。" })
    );

    expect(result.hasHardViolation).toBe(true);
    expect(result.sanitized.dialogue).toBe("望气数据。");
    const terms = result.violations.map((v) => v.term).sort();
    expect(terms).toEqual(["扫描", "数据"]);
  });

  it("sanitizes memory field", () => {
    const result = validateWorldview(
      makeResponse({ memory: "玩家用义体扫描丹炉。" })
    );

    expect(result.sanitized.memory).toBe("玩家用傀儡身望气丹炉。");
    const terms = result.violations.map((v) => v.term).sort();
    expect(terms).toEqual(["义体", "扫描"]);
  });

  it("sanitizes actions array", () => {
    const result = validateWorldview(
      makeResponse({ actions: ["*启动义眼扫描*", "*斜眼*"] })
    );

    expect(result.sanitized.actions).toEqual(["*启动望气瞳望气*", "*斜眼*"]);
  });

  it("does not duplicate violation records when same term appears twice", () => {
    const result = validateWorldview(
      makeResponse({ dialogue: "钱不够就再凑钱。" })
    );

    expect(result.violations).toEqual([{ term: "钱", severity: "soft" }]);
    expect(result.sanitized.dialogue).toBe("灵石不够就再凑灵石。");
  });

  it("preserves intent and state_delta unchanged", () => {
    const original = makeResponse({
      dialogue: "交钱。",
      intent: { type: "offer_trade", params: {} },
      state_delta: { trust: 1, fear: 0, anger: 2, tianDaoAlert: 0 }
    });
    const result = validateWorldview(original);

    expect(result.sanitized.intent).toEqual(original.intent);
    expect(result.sanitized.state_delta).toEqual(original.state_delta);
  });

  it("handles天道云to天道镜replacement", () => {
    const result = validateWorldview(
      makeResponse({ dialogue: "天道云盯着呢。" })
    );

    expect(result.sanitized.dialogue).toBe("天道镜盯着呢。");
    expect(result.violations).toEqual([{ term: "天道云", severity: "soft" }]);
  });
});
