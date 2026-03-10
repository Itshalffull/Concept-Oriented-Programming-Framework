// generated: contentembedding.types.ts

export interface ContentEmbeddingIndexInput {
  entity_id: string;
  source_type: string;
  text: string;
  model: string;
}

export type ContentEmbeddingIndexOutput =
  { variant: "ok"; embedding: string }
  | { variant: "modelUnavailable"; model: string };

export interface ContentEmbeddingRemoveInput {
  entity_id: string;
}

export type ContentEmbeddingRemoveOutput =
  { variant: "ok"; entity_id: string }
  | { variant: "notfound"; entity_id: string };

export interface ContentEmbeddingGetInput {
  entity_id: string;
}

export type ContentEmbeddingGetOutput =
  { variant: "ok"; embedding: string; entity_id: string; source_type: string; model: string; updated_at: string; excerpt: string }
  | { variant: "notfound"; entity_id: string };

export interface ContentEmbeddingSearchSimilarInput {
  entity_id: string;
  topK: number;
  source_type: string;
}

export type ContentEmbeddingSearchSimilarOutput =
  { variant: "ok"; results: string }
  | { variant: "notfound"; entity_id: string }
  | { variant: "empty"; message: string };
