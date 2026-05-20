import { describe, expect, it } from "vitest";
import { blobToVector, cosineSimilarity, EMBEDDING_DIM, getDefaultProvider, vectorToBlob } from "../services/embedding/index.js";

describe("embedding/hashProvider", () => {
  const provider = getDefaultProvider();

  it("uses the hash provider by default", () => {
    expect(provider.name).toBe("hash");
    expect(provider.dim).toBe(EMBEDDING_DIM);
  });

  it("is deterministic across many calls", async () => {
    const reference = await provider.embed("白璃在炼丹");

    for (let i = 0; i < 50; i += 1) {
      const repeat = await provider.embed("白璃在炼丹");
      expect(Array.from(repeat)).toEqual(Array.from(reference));
    }
  });

  it("returns a zero vector for empty input", async () => {
    const vector = await provider.embed("");

    expect(vector).toHaveLength(EMBEDDING_DIM);
    expect(Array.from(vector).every((value) => value === 0)).toBe(true);
  });

  it("returns L2-normalized vectors for non-empty input", async () => {
    const vector = await provider.embed("玩家想买屏蔽丹药");
    const norm = Math.sqrt(Array.from(vector).reduce((acc, value) => acc + value * value, 0));

    expect(norm).toBeCloseTo(1, 5);
  });

  it("places semantically related strings closer than unrelated ones", async () => {
    const queryPill = await provider.embed("天道云屏蔽丹药");
    const matchPill = await provider.embed("玩家想买屏蔽天道云的丹药");
    const matchOther = await provider.embed("赤目要收过路费");

    const simRelated = cosineSimilarity(queryPill, matchPill);
    const simUnrelated = cosineSimilarity(queryPill, matchOther);

    expect(simRelated).toBeGreaterThan(simUnrelated);
    expect(simRelated).toBeGreaterThan(0.3);
  });

  it("embedBatch matches sequential embed", async () => {
    const inputs = ["白璃", "苏鹤", "赤目"];
    const batch = await provider.embedBatch(inputs);
    const sequential = await Promise.all(inputs.map((text) => provider.embed(text)));

    batch.forEach((vector, index) => {
      expect(Array.from(vector)).toEqual(Array.from(sequential[index]));
    });
  });

  it("round-trips vector → blob → vector preserving values", async () => {
    const original = await provider.embed("赛博修仙世界");
    const blob = vectorToBlob(original);
    const restored = blobToVector(blob);

    expect(restored).toHaveLength(original.length);
    expect(Array.from(restored)).toEqual(Array.from(original));
  });

  it("cosineSimilarity returns 1 for identical vectors and 0 for orthogonal", () => {
    const a = new Float32Array([1, 0, 0, 0]);
    const b = new Float32Array([1, 0, 0, 0]);
    const c = new Float32Array([0, 1, 0, 0]);

    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
    expect(cosineSimilarity(a, c)).toBeCloseTo(0, 5);
  });

  it("cosineSimilarity throws when vector dimensions disagree", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([1, 0, 0]);

    expect(() => cosineSimilarity(a, b)).toThrow();
  });
});
