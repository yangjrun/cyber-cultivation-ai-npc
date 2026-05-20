import type { EmbeddingProvider, EmbeddingVector } from "../../types/embedding.js";
import { hashEmbeddingProvider } from "./hashProvider.js";

export { EMBEDDING_DIM } from "../../types/embedding.js";
export type { EmbeddingProvider, EmbeddingVector, SimilarityScore } from "../../types/embedding.js";

export function getDefaultProvider(): EmbeddingProvider {
  const flag = process.env.EMBEDDING_PROVIDER?.toLowerCase();

  if (!flag || flag === "hash") {
    return hashEmbeddingProvider;
  }

  throw new Error(`Unsupported EMBEDDING_PROVIDER: ${flag}. Only "hash" is currently registered.`);
}

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length) {
    throw new Error(`Cosine similarity dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function vectorToBlob(vector: EmbeddingVector): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

export function blobToVector(blob: Buffer): EmbeddingVector {
  if (blob.byteLength % 4 !== 0) {
    throw new Error(`Embedding blob byteLength must be multiple of 4, got ${blob.byteLength}`);
  }

  const copy = new ArrayBuffer(blob.byteLength);
  Buffer.from(copy).set(blob);
  return new Float32Array(copy);
}
