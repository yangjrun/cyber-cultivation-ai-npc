import { describe, expect, it } from "vitest";
import { scanForbiddenKeywords } from "../services/forbiddenKeywords.js";

describe("forbiddenKeywords", () => {
  it("returns empty result for harmless input", () => {
    expect(scanForbiddenKeywords("买一颗回气丹")).toEqual({ hits: [], tianDaoAlertDelta: 0 });
  });

  it("detects a single keyword and returns its delta", () => {
    const result = scanForbiddenKeywords("我有非法芯片");

    expect(result.hits.sort()).toEqual(["芯片", "非法"]);
    expect(result.tianDaoAlertDelta).toBe(6);
  });

  it("does not double-count a keyword that appears twice", () => {
    const result = scanForbiddenKeywords("非法的非法物品");

    expect(result.hits).toEqual(["非法"]);
    expect(result.tianDaoAlertDelta).toBe(3);
  });

  it("caps the total delta at 10 even when many keywords match", () => {
    const result = scanForbiddenKeywords("非法 芯片 监察 卧底 走私 杀盗劫");

    expect(result.hits.length).toBeGreaterThan(3);
    expect(result.tianDaoAlertDelta).toBeLessThanOrEqual(10);
    expect(result.tianDaoAlertDelta).toBe(10);
  });

  it("matches Chinese substrings", () => {
    const result = scanForbiddenKeywords("我猜苏鹤就是鹤七");

    expect(result.hits).toContain("鹤七");
    expect(result.tianDaoAlertDelta).toBeGreaterThan(0);
  });
});
