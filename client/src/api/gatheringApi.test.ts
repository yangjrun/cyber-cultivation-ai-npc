import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchGatheringPoints, gather } from "./gatheringApi";

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });

describe("gatheringApi", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("fetchGatheringPoints", () => {
    it("normalizes gathering points with availability", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        okJson({
          points: [
            {
              pointId: "black_market_herbs",
              name: "废弃药摊",
              description: "黑市角落",
              qiCost: 10,
              cooldownHours: 6,
              alertRisk: 1,
              available: true,
              nextAvailableAt: null
            }
          ]
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      const points = await fetchGatheringPoints("s1", "black_market");
      expect(points.length).toBe(1);
      expect(points[0].pointId).toBe("black_market_herbs");
      expect(points[0].name).toBe("废弃药摊");
      expect(points[0].qiCost).toBe(10);
      expect(points[0].available).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith("/api/gathering/s1/black_market", expect.any(Object));
    });

    it("returns empty array when points are missing", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okJson({}));
      vi.stubGlobal("fetch", fetchMock);

      const points = await fetchGatheringPoints("s1", "black_market");
      expect(points).toEqual([]);
    });

    it("url-encodes session and scene ids", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okJson({ points: [] }));
      vi.stubGlobal("fetch", fetchMock);

      await fetchGatheringPoints("a b", "s/c");
      expect(fetchMock).toHaveBeenCalledWith("/api/gathering/a%20b/s%2Fc", expect.any(Object));
    });
  });

  describe("gather", () => {
    it("posts the gather body and normalizes the response", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        okJson({
          success: true,
          itemsGained: [
            { itemId: "shadow_herb", quantity: 2, item: { id: "shadow_herb", name: "影髓草", type: "material", description: "", basePrice: 18 } }
          ],
          qiCost: 10,
          alertDelta: 1,
          message: "采集成功",
          nextAvailableAt: "2026-05-30T12:00:00.000Z",
          player: { qiCurrent: 90 },
          inventory: [{ itemId: "shadow_herb", quantity: 5, item: null }]
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await gather("s1", "black_market_herbs");
      expect(result.success).toBe(true);
      expect(result.itemsGained.length).toBe(1);
      expect(result.itemsGained[0].itemId).toBe("shadow_herb");
      expect(result.itemsGained[0].quantity).toBe(2);
      expect(result.qiCost).toBe(10);
      expect(result.player.qiCurrent).toBe(90);

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body as string)).toEqual({
        sessionId: "s1",
        pointId: "black_market_herbs"
      });
    });

    it("normalizes a failed gather", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        okJson({
          success: false,
          itemsGained: [],
          qiCost: 10,
          alertDelta: 0,
          message: "采集失败",
          nextAvailableAt: "2026-05-30T12:00:00.000Z",
          player: { qiCurrent: 90 },
          inventory: []
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await gather("s1", "black_market_herbs");
      expect(result.success).toBe(false);
      expect(result.itemsGained).toEqual([]);
    });
  });
});
