// generated: contentembedding.handler.ts
import type { ConceptStorage } from "@clef/runtime";
import type * as T from "./contentembedding.types";

export interface ContentEmbeddingHandler {
  index(input: T.ContentEmbeddingIndexInput, storage: ConceptStorage):
    Promise<T.ContentEmbeddingIndexOutput>;
  remove(input: T.ContentEmbeddingRemoveInput, storage: ConceptStorage):
    Promise<T.ContentEmbeddingRemoveOutput>;
  get(input: T.ContentEmbeddingGetInput, storage: ConceptStorage):
    Promise<T.ContentEmbeddingGetOutput>;
  searchSimilar(input: T.ContentEmbeddingSearchSimilarInput, storage: ConceptStorage):
    Promise<T.ContentEmbeddingSearchSimilarOutput>;
}
