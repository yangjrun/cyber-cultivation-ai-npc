import { describe, expect, it } from "vitest";
import {
  computeBuyUnitPrice,
  computeSellUnitPrice,
  isTradeRefused,
  type PriceInputs
} from "../services/tradeEngine.js";

const neutralMood = { trust: 0, fear: 0, anger: 0 };

function makeInputs(overrides: Partial<PriceInputs> = {}): PriceInputs {
  return {
    basePrice: 100,
    npcMood: neutralMood,
    npcStock: 5,
    referenceStock: 5,
    cultivationStageIdx: 0,
    ...overrides
  };
}

describe("tradeEngine.isTradeRefused", () => {
  it("refuses when anger reaches 80", () => {
    expect(isTradeRefused({ trust: 0, fear: 0, anger: 80 }).refused).toBe(true);
  });

  it("refuses when fear reaches 80", () => {
    expect(isTradeRefused({ trust: 0, fear: 90, anger: 0 }).refused).toBe(true);
  });

  it("allows trade for calm npc", () => {
    expect(isTradeRefused({ trust: 50, fear: 10, anger: 20 }).refused).toBe(false);
  });

  it("returns a reason when refused", () => {
    expect(isTradeRefused({ trust: 0, fear: 0, anger: 95 }).reason).toBeTruthy();
  });
});

describe("tradeEngine.computeBuyUnitPrice", () => {
  it("returns a positive integer", () => {
    const price = computeBuyUnitPrice(makeInputs());
    expect(Number.isInteger(price)).toBe(true);
    expect(price).toBeGreaterThanOrEqual(1);
  });

  it("never drops below 1 even for cheap items", () => {
    const price = computeBuyUnitPrice(makeInputs({ basePrice: 1, npcMood: { trust: 100, fear: 0, anger: 0 } }));
    expect(price).toBeGreaterThanOrEqual(1);
  });

  it("is cheaper when trust is high", () => {
    const base = computeBuyUnitPrice(makeInputs());
    const trusting = computeBuyUnitPrice(makeInputs({ npcMood: { trust: 90, fear: 0, anger: 0 } }));
    expect(trusting).toBeLessThan(base);
  });

  it("is more expensive when anger is high", () => {
    const base = computeBuyUnitPrice(makeInputs());
    const angry = computeBuyUnitPrice(makeInputs({ npcMood: { trust: 0, fear: 0, anger: 70 } }));
    expect(angry).toBeGreaterThan(base);
  });

  it("is more expensive when npc stock is scarce", () => {
    const base = computeBuyUnitPrice(makeInputs({ npcStock: 5, referenceStock: 5 }));
    const scarce = computeBuyUnitPrice(makeInputs({ npcStock: 1, referenceStock: 5 }));
    expect(scarce).toBeGreaterThan(base);
  });

  it("is cheaper for higher cultivation stage", () => {
    const novice = computeBuyUnitPrice(makeInputs({ cultivationStageIdx: 0 }));
    const master = computeBuyUnitPrice(makeInputs({ cultivationStageIdx: 14 }));
    expect(master).toBeLessThanOrEqual(novice);
  });
});

describe("tradeEngine.computeSellUnitPrice", () => {
  it("returns a positive integer", () => {
    const price = computeSellUnitPrice(makeInputs());
    expect(Number.isInteger(price)).toBe(true);
    expect(price).toBeGreaterThanOrEqual(1);
  });

  it("pays more when trust is high", () => {
    const base = computeSellUnitPrice(makeInputs());
    const trusting = computeSellUnitPrice(makeInputs({ npcMood: { trust: 90, fear: 0, anger: 0 } }));
    expect(trusting).toBeGreaterThan(base);
  });

  it("pays less when npc already holds many", () => {
    const fewHeld = computeSellUnitPrice(makeInputs({ npcStock: 0 }));
    const manyHeld = computeSellUnitPrice(makeInputs({ npcStock: 10 }));
    expect(manyHeld).toBeLessThan(fewHeld);
  });
});

describe("tradeEngine invariants", () => {
  it("sell price never exceeds basePrice * 1.5 cap", () => {
    const moods = [
      { trust: 100, fear: 0, anger: 0 },
      { trust: 50, fear: 30, anger: 20 },
      { trust: 0, fear: 0, anger: 70 }
    ];

    for (const npcMood of moods) {
      for (const npcStock of [0, 1, 5, 10]) {
        for (const cultivationStageIdx of [0, 7, 14]) {
          for (const basePrice of [30, 120, 420]) {
            const inputs = makeInputs({ basePrice, npcMood, npcStock, cultivationStageIdx });
            const sell = computeSellUnitPrice(inputs);
            const cap = Math.round(basePrice * 1.5);
            expect(sell).toBeLessThanOrEqual(cap);
          }
        }
      }
    }
  });

  it("buy and sell are both positive integers", () => {
    for (const npcStock of [0, 5, 10]) {
      for (const stageIdx of [0, 7, 14]) {
        const inputs = makeInputs({ npcStock, cultivationStageIdx: stageIdx });
        const buy = computeBuyUnitPrice(inputs);
        const sell = computeSellUnitPrice(inputs);
        expect(Number.isInteger(buy)).toBe(true);
        expect(Number.isInteger(sell)).toBe(true);
        expect(buy).toBeGreaterThanOrEqual(1);
        expect(sell).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe("tradeEngine.computeSellUnitPrice with quality", () => {
  it("applies no multiplier for common quality", () => {
    const base = computeSellUnitPrice(makeInputs({ basePrice: 100 }));
    const common = computeSellUnitPrice(makeInputs({ basePrice: 100 }), "common");
    expect(common).toBe(base);
  });

  it("applies 1.15x multiplier for fine quality", () => {
    const base = computeSellUnitPrice(makeInputs({ basePrice: 100 }));
    const fine = computeSellUnitPrice(makeInputs({ basePrice: 100 }), "fine");
    expect(fine).toBeGreaterThan(base);
    expect(fine).toBeLessThanOrEqual(Math.round(base * 1.2));
  });

  it("applies 1.4x multiplier for perfect quality", () => {
    const base = computeSellUnitPrice(makeInputs({ basePrice: 100 }));
    const perfect = computeSellUnitPrice(makeInputs({ basePrice: 100 }), "perfect");
    expect(perfect).toBeGreaterThan(base);
    expect(perfect).toBeGreaterThan(computeSellUnitPrice(makeInputs({ basePrice: 100 }), "fine"));
  });

  it("still respects the 1.5x cap even with perfect quality", () => {
    const basePrice = 100;
    const inputs = makeInputs({ basePrice, npcMood: { trust: 100, fear: 0, anger: 0 } });
    const perfect = computeSellUnitPrice(inputs, "perfect");
    const cap = Math.round(basePrice * 1.5);
    expect(perfect).toBeLessThanOrEqual(cap);
  });

  it("returns at least 1 for low-price items with quality", () => {
    const perfect = computeSellUnitPrice(makeInputs({ basePrice: 1 }), "perfect");
    expect(perfect).toBeGreaterThanOrEqual(1);
  });

  it("quality multiplier works across different base prices", () => {
    for (const basePrice of [30, 120, 420]) {
      const common = computeSellUnitPrice(makeInputs({ basePrice }), "common");
      const fine = computeSellUnitPrice(makeInputs({ basePrice }), "fine");
      const perfect = computeSellUnitPrice(makeInputs({ basePrice }), "perfect");

      expect(fine).toBeGreaterThanOrEqual(common);
      expect(perfect).toBeGreaterThan(fine);
    }
  });
});
