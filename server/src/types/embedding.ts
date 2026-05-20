export const EMBEDDING_DIM = 128;

export type EmbeddingVector = Float32Array;

export type SimilarityScore = {
  id: number;
  content: string;
  score: number;
};

export interface EmbeddingProvider {
  readonly name: string;
  readonly dim: number;
  embed(text: string): Promise<EmbeddingVector>;
  embedBatch(texts: string[]): Promise<EmbeddingVector[]>;
}
