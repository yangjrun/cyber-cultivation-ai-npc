import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buyItem, fetchShop, sellItem } from "./tradeApi";

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });

describe("tradeApi", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("fetchShop", () => {
    it("normalizes a shop snapshot with buy prices and basePrice", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        okJson({
          shop: {
            npcId: "baili",
            npcName: "白璃",
            npcSpiritStones: 800,
            refused: false,
            items: [
              {
                itemId: "cheap_qi_pill",
                item: { id: "cheap_qi_pill", name: "粗制回气丹", type: "pill", description: "回气。", basePrice: 30 },
                quantity: 5,
                buyUnitPrice: 31
              }
            ],
            sellQuotes: []
          }
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      const shop = await fetchShop("s1", "baili");
      expect(shop.npcName).toBe("白璃");
      expect(shop.npcSpiritStones).toBe(800);
      expect(shop.refused).toBe(false);
      expect(shop.items[0].buyUnitPrice).toBe(31);
      expect(shop.items[0].item?.basePrice).toBe(30);
      expect(fetchMock).toHaveBeenCalledWith("/api/trade/s1/baili", expect.any(Object));
    });

    it("falls back to safe defaults when fields are missing", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okJson({}));
      vi.stubGlobal("fetch", fetchMock);

      const shop = await fetchShop("s1", "baili");
      expect(shop.npcSpiritStones).toBe(0);
      expect(shop.refused).toBe(false);
      expect(shop.items).toEqual([]);
      expect(shop.sellQuotes).toEqual([]);
    });

    it("url-encodes session and npc ids", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okJson({ shop: {} }));
      vi.stubGlobal("fetch", fetchMock);

      await fetchShop("a b", "n/c");
      expect(fetchMock).toHaveBeenCalledWith("/api/trade/a%20b/n%2Fc", expect.any(Object));
    });
  });

  describe("buyItem", () => {
    it("posts the trade body and normalizes the response", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        okJson({
          kind: "buy",
          itemId: "cheap_qi_pill",
          item: { id: "cheap_qi_pill", name: "粗制回气丹", type: "pill", description: "回气。", basePrice: 30 },
          quantity: 1,
          unitPrice: 31,
          totalPrice: 31,
          player: { spiritStones: 969 },
          inventory: [{ itemId: "cheap_qi_pill", quantity: 2, item: null }],
          npcState: { trust: 21, fear: 10, anger: 0, tianDaoAlert: 45 },
          shop: { npcId: "baili", items: [], sellQuotes: [] },
          message: "以 31 灵石购入 粗制回气丹 ×1。"
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await buyItem("s1", "baili", "cheap_qi_pill", 1);
      expect(result.kind).toBe("buy");
      expect(result.totalPrice).toBe(31);
      expect(result.player.spiritStones).toBe(969);
      expect(result.npcState?.trust).toBe(21);

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body as string)).toEqual({
        sessionId: "s1",
        npcId: "baili",
        itemId: "cheap_qi_pill",
        quantity: 1
      });
    });
  });

  describe("sellItem", () => {
    it("posts to the sell endpoint", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        okJson({ kind: "sell", player: {}, inventory: [], shop: {}, message: "" })
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await sellItem("s1", "baili", "shadow_herb", 2);
      expect(result.kind).toBe("sell");
      expect(fetchMock.mock.calls[0][0]).toBe("/api/trade/sell");
    });
  });
});
