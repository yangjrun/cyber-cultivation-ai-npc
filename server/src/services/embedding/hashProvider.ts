import { EMBEDDING_DIM, type EmbeddingProvider, type EmbeddingVector } from "../../types/embedding.js";

const MAX_TOKENS = 256;
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

class HashEmbeddingProvider implements EmbeddingProvider {
  readonly name = "hash";
  readonly dim = EMBEDDING_DIM;

  async embed(text: string): Promise<EmbeddingVector> {
    return embedSync(text);
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    return texts.map(embedSync);
  }
}

export const hashEmbeddingProvider: EmbeddingProvider = new HashEmbeddingProvider();

export function embedSync(text: string): EmbeddingVector {
  const tokens = tokenize(text).slice(0, MAX_TOKENS);
  const vector = new Float32Array(EMBEDDING_DIM);

  if (tokens.length === 0) {
    return vector;
  }

  const tokenFreq = new Map<string, number>();

  for (const token of tokens) {
    tokenFreq.set(token, (tokenFreq.get(token) ?? 0) + 1);
  }

  for (const [token, freq] of tokenFreq) {
    const bucket = fnvHash(token) % EMBEDDING_DIM;
    vector[bucket] += 1 / Math.sqrt(freq);
  }

  return l2Normalize(vector);
}

function tokenize(text: string): string[] {
  if (!text) {
    return [];
  }

  const tokens: string[] = [];
  let i = 0;

  while (i < text.length) {
    const code = text.charCodeAt(i);

    if (isCjk(code)) {
      tokens.push(text[i]);
      i += 1;
      continue;
    }

    if (isAlphanumeric(code)) {
      let j = i;

      while (j < text.length && isAlphanumeric(text.charCodeAt(j))) {
        j += 1;
      }

      tokens.push(text.slice(i, j).toLowerCase());
      i = j;
      continue;
    }

    i += 1;
  }

  return tokens;
}

function isCjk(code: number): boolean {
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0x3040 && code <= 0x30ff)
  );
}

function isAlphanumeric(code: number): boolean {
  return (
    (code >= 0x30 && code <= 0x39) ||
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a)
  );
}

function fnvHash(text: string): number {
  let hash = FNV_OFFSET;

  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
}

function l2Normalize(vector: Float32Array): Float32Array {
  let norm = 0;

  for (let i = 0; i < vector.length; i += 1) {
    norm += vector[i] * vector[i];
  }

  if (norm === 0) {
    return vector;
  }

  const scale = 1 / Math.sqrt(norm);

  for (let i = 0; i < vector.length; i += 1) {
    vector[i] *= scale;
  }

  return vector;
}
