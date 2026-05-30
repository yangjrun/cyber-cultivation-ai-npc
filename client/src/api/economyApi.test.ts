import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimPassiveIncome } from "./economyApi";

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });

describe("economyApi", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("claimPassiveIncome", () => {
    it("posts to the claim endpoint and normalizes the response", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        okJson({
          claimed: true,
          amount: 40,
          daysAccrued: 2,
          message: "凝聚了 2 日灵气，入账 40 灵石。",
          player: { spiritStones: 40 }
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await claimPassiveIncome("s1");
      expect(result.claimed).toBe(true);
      expect(result.amount).toBe(40);
      expect(result.daysAccrued).toBe(2);
      expect(result.player.spiritStones).toBe(40);

      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/economy/passive-income/claim");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body as string)).toEqual({ sessionId: "s1" });
    });

    it("normalizes a no-payout response with safe defaults", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        okJson({ claimed: false, message: "练气期还凝聚不出灵石。", player: {} })
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await claimPassiveIncome("s1");
      expect(result.claimed).toBe(false);
      expect(result.amount).toBe(0);
      expect(result.daysAccrued).toBe(0);
    });
  });
});
