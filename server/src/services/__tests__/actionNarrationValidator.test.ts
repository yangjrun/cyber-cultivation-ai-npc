import { describe, expect, it } from "vitest";
import { validateActionNarration } from "../actionNarrationValidator.js";

describe("actionNarrationValidator", () => {
  const fallback = "（潜行：测试动作）";

  it("accepts valid narration", () => {
    const result = validateActionNarration(
      "陆玄悄悄伸手，指尖轻触白璃的大腿。白璃猛地一惊，眼神如刀锋般扫来。",
      fallback
    );

    expect(result.fallbackUsed).toBe(false);
    expect(result.narration).toContain("陆玄");
    expect(result.narration).toContain("白璃");
  });

  it("trims whitespace from valid narration", () => {
    const result = validateActionNarration(
      "  陆玄悄悄伸手，白璃一惊。  ",
      fallback
    );

    expect(result.fallbackUsed).toBe(false);
    expect(result.narration).toBe("陆玄悄悄伸手，白璃一惊。");
  });

  it("removes surrounding quotes", () => {
    const result = validateActionNarration(
      '"陆玄悄悄伸手，白璃一惊。"',
      fallback
    );

    expect(result.fallbackUsed).toBe(false);
    expect(result.narration).toBe("陆玄悄悄伸手，白璃一惊。");
  });

  it("rejects empty string", () => {
    const result = validateActionNarration("", fallback);

    expect(result.fallbackUsed).toBe(true);
    expect(result.narration).toBe(fallback);
  });

  it("rejects null or undefined", () => {
    const result1 = validateActionNarration(null as unknown as string, fallback);
    const result2 = validateActionNarration(undefined as unknown as string, fallback);

    expect(result1.fallbackUsed).toBe(true);
    expect(result2.fallbackUsed).toBe(true);
  });

  it("rejects narration that is too short", () => {
    const result = validateActionNarration("太短", fallback);

    expect(result.fallbackUsed).toBe(true);
    expect(result.narration).toBe(fallback);
  });

  it("rejects narration that is too long", () => {
    const longText = "很长的文本".repeat(101); // 505 characters, exceeds 500 limit
    const result = validateActionNarration(longText, fallback);

    expect(result.fallbackUsed).toBe(true);
    expect(result.narration).toBe(fallback);
  });

  it("rejects JSON-like responses", () => {
    const result1 = validateActionNarration(
      '{"narration": "陆玄悄悄伸手"}',
      fallback
    );
    const result2 = validateActionNarration(
      '["陆玄悄悄伸手"]',
      fallback
    );

    expect(result1.fallbackUsed).toBe(true);
    expect(result2.fallbackUsed).toBe(true);
  });

  it("rejects narration with forbidden keywords", () => {
    const result = validateActionNarration(
      "陆玄拿出监察令牌，准备行动。",
      fallback
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.narration).toBe(fallback);
  });

  it("accepts narration with multiple sentences", () => {
    const result = validateActionNarration(
      "陆玄悄悄伸手。白璃一惊。周围的人都没注意到。",
      fallback
    );

    expect(result.fallbackUsed).toBe(false);
  });
});
