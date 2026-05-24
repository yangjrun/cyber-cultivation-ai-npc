import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { equipArtifact, fetchArtifacts, unequipArtifact } from "./artifactApi";

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });

describe("artifactApi", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("fetchArtifacts", () => {
    it("returns parsed owned + catalog arrays", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        okJson({
          owned: [
            {
              id: "fentian_ling",
              name: "焚天令",
              description: "白璃丹炉旧令。",
              visibleTag: "佩焚天令",
              equipped: true
            }
          ],
          catalog: [
            {
              id: "fentian_ling",
              name: "焚天令",
              description: "白璃丹炉旧令。",
              visibleTag: "佩焚天令"
            }
          ]
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await fetchArtifacts("s1");
      expect(result.owned).toHaveLength(1);
      expect(result.owned[0]).toEqual({
        id: "fentian_ling",
        name: "焚天令",
        description: "白璃丹炉旧令。",
        visibleTag: "佩焚天令",
        equipped: true
      });
      expect(result.catalog).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledWith("/api/artifacts/s1", expect.any(Object));
    });

    it("url-encodes the sessionId", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okJson({ owned: [], catalog: [] }));
      vi.stubGlobal("fetch", fetchMock);

      await fetchArtifacts("s 1/x");
      expect(fetchMock).toHaveBeenCalledWith("/api/artifacts/s%201%2Fx", expect.any(Object));
    });

    it("returns empty arrays when body is not an object", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okJson("nope"));
      vi.stubGlobal("fetch", fetchMock);

      const result = await fetchArtifacts("s1");
      expect(result).toEqual({ owned: [], catalog: [] });
    });

    it("filters out malformed owned entries", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        okJson({
          owned: [
            { id: "ok", name: "good", description: "d", visibleTag: "t", equipped: false },
            { id: 42, name: "bad" },
            null,
            { id: "missing-equipped", name: "n", description: "d", visibleTag: "t" }
          ],
          catalog: []
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await fetchArtifacts("s1");
      expect(result.owned).toHaveLength(1);
      expect(result.owned[0]?.id).toBe("ok");
    });

    it("filters out malformed catalog entries", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        okJson({
          owned: [],
          catalog: [
            { id: "ok", name: "n", description: "d", visibleTag: "t" },
            { id: 1, name: "x", description: "d", visibleTag: "t" },
            "string-not-object"
          ]
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await fetchArtifacts("s1");
      expect(result.catalog).toHaveLength(1);
      expect(result.catalog[0]?.id).toBe("ok");
    });
  });

  describe("equipArtifact", () => {
    it("POSTs to /equip with json body", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okJson({ ok: true }));
      vi.stubGlobal("fetch", fetchMock);

      await equipArtifact("s1", "fentian_ling");
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/artifacts/s1/equip",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artifactId: "fentian_ling" })
        })
      );
    });
  });

  describe("unequipArtifact", () => {
    it("POSTs to /unequip with json body", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okJson({ ok: true }));
      vi.stubGlobal("fetch", fetchMock);

      await unequipArtifact("s1", "yinggu_fu");
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/artifacts/s1/unequip",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artifactId: "yinggu_fu" })
        })
      );
    });
  });
});
