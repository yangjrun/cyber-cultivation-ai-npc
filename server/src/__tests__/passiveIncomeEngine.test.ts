import { describe, expect, it } from "vitest";
import { calculatePassiveIncome } from "../services/passiveIncomeEngine.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("passiveIncomeEngine.calculatePassiveIncome", () => {
  it("returns nothing for 练气期 (stage idx < 9)", () => {
    const result = calculatePassiveIncome(0, null);
    expect(result.claimed).toBe(false);
    expect(result.amount).toBe(0);
    expect(result.message).toContain("练气期");
  });

  it("sets an anchor on first claim without paying out", () => {
    const now = new Date("2026-05-31T00:00:00.000Z");
    const result = calculatePassiveIncome(9, null, now);
    expect(result.claimed).toBe(false);
    expect(result.amount).toBe(0);
    expect(result.newClaimedAt).toBe(now.toISOString());
  });

  it("pays nothing if less than one full day elapsed", () => {
    const lastClaimed = "2026-05-31T00:00:00.000Z";
    const now = new Date("2026-05-31T10:00:00.000Z"); // 10h later
    const result = calculatePassiveIncome(9, lastClaimed, now);
    expect(result.claimed).toBe(false);
    expect(result.amount).toBe(0);
    expect(result.newClaimedAt).toBe(lastClaimed);
  });

  it("pays one day of income for 筑基初期 after 24h", () => {
    const lastClaimed = new Date("2026-05-30T00:00:00.000Z");
    const now = new Date(lastClaimed.getTime() + DAY);
    const result = calculatePassiveIncome(9, lastClaimed.toISOString(), now);
    expect(result.claimed).toBe(true);
    expect(result.daysAccrued).toBe(1);
    expect(result.amount).toBe(5); // 筑基初期 = 5/day
  });

  it("accrues multiple days up to the cap of 7", () => {
    const lastClaimed = new Date("2026-05-01T00:00:00.000Z");
    const now = new Date(lastClaimed.getTime() + 30 * DAY); // 30 days later
    const result = calculatePassiveIncome(12, lastClaimed.toISOString(), now); // 金丹初期 = 20/day
    expect(result.daysAccrued).toBe(7); // capped
    expect(result.amount).toBe(140); // 7 * 20
  });

  it("scales income by realm tier", () => {
    const lastClaimed = new Date("2026-05-30T00:00:00.000Z");
    const now = new Date(lastClaimed.getTime() + DAY);

    expect(calculatePassiveIncome(9, lastClaimed.toISOString(), now).amount).toBe(5);   // 筑基初期
    expect(calculatePassiveIncome(10, lastClaimed.toISOString(), now).amount).toBe(8);  // 筑基中期
    expect(calculatePassiveIncome(11, lastClaimed.toISOString(), now).amount).toBe(12); // 筑基后期
    expect(calculatePassiveIncome(12, lastClaimed.toISOString(), now).amount).toBe(20); // 金丹初期
    expect(calculatePassiveIncome(13, lastClaimed.toISOString(), now).amount).toBe(28); // 金丹中期
    expect(calculatePassiveIncome(14, lastClaimed.toISOString(), now).amount).toBe(36); // 金丹后期
  });

  it("advances the anchor by consumed days only, keeping the remainder", () => {
    const lastClaimed = new Date("2026-05-30T00:00:00.000Z");
    const now = new Date(lastClaimed.getTime() + DAY + 10 * HOUR); // 1 day 10h
    const result = calculatePassiveIncome(9, lastClaimed.toISOString(), now);

    expect(result.daysAccrued).toBe(1);
    // anchor advanced exactly 1 day, the 10h remainder is preserved
    expect(result.newClaimedAt).toBe(new Date(lastClaimed.getTime() + DAY).toISOString());
  });

  it("preserves remainder so the next claim is not reset", () => {
    const lastClaimed = new Date("2026-05-30T00:00:00.000Z");
    const firstNow = new Date(lastClaimed.getTime() + DAY + 10 * HOUR);
    const first = calculatePassiveIncome(9, lastClaimed.toISOString(), firstNow);

    // 14h after the new anchor should still be < 1 day from it -> but 10h remainder + 14h = 24h
    const secondNow = new Date(firstNow.getTime() + 14 * HOUR);
    const second = calculatePassiveIncome(9, first.newClaimedAt, secondNow);
    expect(second.daysAccrued).toBe(1);
  });
});
