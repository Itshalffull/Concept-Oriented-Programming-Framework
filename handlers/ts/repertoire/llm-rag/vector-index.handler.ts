// @clef-handler style=functional
// ============================================================
// VectorIndex Concept Implementation
//
// Stores embedding vectors with metadata and provides similarity
// search. Abstracts over backends (FAISS, Pinecone, pgvector, etc.).
// Supports hybrid search combining vector similarity with keyword
// search via reciprocal rank fusion. Manages embedding configuration.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_DISTANCES = ['cosine', 'dot_product', 'euclidean'];
const VALID_INDEX_TYPES = ['hnsw', 'ivf_flat', 'flat'];
const VALID_BACKENDS = ['pinecone', 'qdrant', 'chromadb', 'pgvector', 'faiss', 'weaviate'];

let _indexCounter = 0;
function generateIndexId(): string {
  return `vidx-${Date.now()}-${++_indexCounter}`;
}

/** Stub cosine similarity between two vectors. */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/** Stub embedding generator. Production uses actual embedding model via perform(). */
function stubEmbed(text: string, dimensions: number): number[] {
  const vec: number[] = [];
  for (let i = 0; i < dimensions; i++) {
    // Deterministic pseudo-embedding based on text hash
    vec.push(Math.sin((text.charCodeAt(i % text.length) + i) * 0.1));
  }
  return vec;
}

const _vectorIndexHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const dimensions = input.dimensions as number;
    const distanceMetric = input.distance_metric as string;
    const indexType = input.index_type as string;
    const backend = input.backend as string;
    const embeddingModel = input.embedding_model as string;

    if (!dimensions || dimensions <= 0) {
      return complete(createProgram(), 'invalid', { message: 'dimensions must be positive' }) as StorageProgram<Result>;
    }
    if (!VALID_DISTANCES.includes(distanceMetric)) {
      return complete(createProgram(), 'invalid', { message: `Invalid distance metric: ${distanceMetric}` }) as StorageProgram<Result>;
    }
    if (!VALID_INDEX_TYPES.includes(indexType)) {
      return complete(createProgram(), 'invalid', { message: `Invalid index type: ${indexType}` }) as StorageProgram<Result>;
    }
    if (!VALID_BACKENDS.includes(backend)) {
      return complete(createProgram(), 'invalid', { message: `Invalid backend: ${backend}` }) as StorageProgram<Result>;
    }

    const id = generateIndexId();
    let p = createProgram();
    p = put(p, 'indexes', id, {
      id,
      dimensions,
      distance_metric: distanceMetric,
      index_type: indexType,
      backend,
      embedding_model: embeddingModel,
      collections: [],
      document_count: 0,
      index_config: null,
    });

    return complete(p, 'ok', { index: id }) as StorageProgram<Result>;
  },

  embed(input: Record<string, unknown>) {
    const indexId = input.index as string;
    const text = input.text as string;

    let p = createProgram();
    p = get(p, 'indexes', indexId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Embedding model unavailable' }),
      (() => {
        let b = createProgram();
        b = get(b, 'indexes', indexId, 'existing');
        b = mapBindings(b, (bindings) => {
          const idx = bindings.existing as Record<string, unknown>;
          const dims = idx.dimensions as number;
          return stubEmbed(text, dims);
        }, 'vector');

        return completeFrom(b, 'ok', (bindings) => ({
          vector: bindings.vector as number[],
        }));
      })(),
    ) as StorageProgram<Result>;
  },

  embedBatch(input: Record<string, unknown>) {
    const indexId = input.index as string;
    const texts = input.texts as string[];

    let p = createProgram();
    p = get(p, 'indexes', indexId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'partial', { completed: 0, failed: texts.length }),
      (() => {
        let b = createProgram();
        b = get(b, 'indexes', indexId, 'existing');
        b = mapBindings(b, (bindings) => {
          const idx = bindings.existing as Record<string, unknown>;
          const dims = idx.dimensions as number;
          return texts.map(t => ({
            text: t,
            vector: stubEmbed(t, dims),
          }));
        }, 'vectors');

        return completeFrom(b, 'ok', (bindings) => ({
          vectors: bindings.vectors as unknown[],
          count: (bindings.vectors as unknown[]).length,
        }));
      })(),
    ) as StorageProgram<Result>;
  },

  add(input: Record<string, unknown>) {
    const indexId = input.index as string;
    const vecId = input.id as string;
    const vector = input.vector as number[];
    const metadata = (input.metadata as string | null) ?? null;

    let p = createProgram();
    p = get(p, 'indexes', indexId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'dimension_mismatch', { expected: 0, got: vector.length }),
      (() => {
        let b = createProgram();
        b = get(b, 'indexes', indexId, 'existing');
        b = mapBindings(b, (bindings) => {
          const idx = bindings.existing as Record<string, unknown>;
          return idx.dimensions as number;
        }, 'dims');

        return branch(b,
          (bindings) => (bindings.dims as number) !== vector.length,
          (() => {
            let e = createProgram();
            e = get(e, 'indexes', indexId, 'existing');
            e = mapBindings(e, (bindings) => (bindings.existing as Record<string, unknown>).dimensions, 'expected');
            return completeFrom(e, 'dimension_mismatch', (bindings) => ({
              expected: bindings.expected as number,
              got: vector.length,
            }));
          })(),
          (() => {
            let s = createProgram();
            s = put(s, 'vectors', `${indexId}:${vecId}`, {
              id: vecId,
              index_id: indexId,
              vector,
              metadata,
            });
            // Update document count
            s = get(s, 'indexes', indexId, 'idxRecord');
            s = putFrom(s, 'indexes', indexId, (bindings) => {
              const idx = bindings.idxRecord as Record<string, unknown>;
              return { ...idx, document_count: (idx.document_count as number) + 1 };
            });
            return complete(s, 'ok', {});
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  addBatch(input: Record<string, unknown>) {
    const indexId = input.index as string;
    const items = input.items as { id: string; vector: number[]; metadata: string | null }[];

    let p = createProgram();
    p = get(p, 'indexes', indexId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'partial', { added: 0, failed: items.length, errors: ['Index not found'] }),
      (() => {
        let b = createProgram();
        b = get(b, 'indexes', indexId, 'existing');

        // Store each vector
        for (const item of items) {
          b = put(b, 'vectors', `${indexId}:${item.id}`, {
            id: item.id,
            index_id: indexId,
            vector: item.vector,
            metadata: item.metadata ?? null,
          });
        }

        // Update document count
        b = putFrom(b, 'indexes', indexId, (bindings) => {
          const idx = bindings.existing as Record<string, unknown>;
          return { ...idx, document_count: (idx.document_count as number) + items.length };
        });

        return complete(b, 'ok', { count: items.length });
      })(),
    ) as StorageProgram<Result>;
  },

  search(input: Record<string, unknown>) {
    const indexId = input.index as string;
    const queryVector = input.query_vector as number[];
    const k = input.k as number;
    const filters = (input.filters as string | null) ?? null;

    let p = createProgram();
    p = find(p, 'vectors', { index_id: indexId }, 'allVectors');

    return branch(p,
      (bindings) => (bindings.allVectors as unknown[]).length === 0,
      complete(createProgram(), 'empty', { message: 'No results' }),
      (() => {
        let b = createProgram();
        b = find(b, 'vectors', { index_id: indexId }, 'allVectors');
        b = mapBindings(b, (bindings) => {
          const vecs = bindings.allVectors as Record<string, unknown>[];
          const scored = vecs.map(v => ({
            id: v.id as string,
            score: cosineSimilarity(queryVector, v.vector as number[]),
            metadata: v.metadata as string | null,
          }));
          scored.sort((a, b) => b.score - a.score);
          return scored.slice(0, k);
        }, 'results');

        return branch(b,
          (bindings) => (bindings.results as unknown[]).length === 0,
          complete(createProgram(), 'empty', { message: 'No results' }),
          completeFrom(createProgram(), 'ok', (bindings) => ({
            results: bindings.results as unknown[],
          })),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  hybridSearch(input: Record<string, unknown>) {
    const indexId = input.index as string;
    const queryVector = input.query_vector as number[];
    const keywordQuery = input.keyword_query as string;
    const vectorWeight = input.vector_weight as number;
    const k = input.k as number;

    let p = createProgram();
    p = find(p, 'vectors', { index_id: indexId }, 'allVectors');

    return branch(p,
      (bindings) => (bindings.allVectors as unknown[]).length === 0,
      complete(createProgram(), 'empty', { message: 'No results' }),
      (() => {
        let b = createProgram();
        b = find(b, 'vectors', { index_id: indexId }, 'allVectors');
        b = mapBindings(b, (bindings) => {
          const vecs = bindings.allVectors as Record<string, unknown>[];
          const keywords = keywordQuery.toLowerCase().split(/\s+/);

          const scored = vecs.map(v => {
            const vecScore = cosineSimilarity(queryVector, v.vector as number[]);
            // Stub BM25: simple keyword overlap with metadata
            const meta = (v.metadata as string) || '';
            const keywordScore = keywords.filter(kw => meta.toLowerCase().includes(kw)).length / Math.max(keywords.length, 1);
            const combined = vectorWeight * vecScore + (1 - vectorWeight) * keywordScore;
            return {
              id: v.id as string,
              score: combined,
              metadata: v.metadata as string | null,
            };
          });
          scored.sort((a, b) => b.score - a.score);
          return scored.slice(0, k);
        }, 'results');

        return branch(b,
          (bindings) => (bindings.results as unknown[]).length === 0,
          complete(createProgram(), 'empty', { message: 'No results' }),
          completeFrom(createProgram(), 'ok', (bindings) => ({
            results: bindings.results as unknown[],
          })),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  mmrSearch(input: Record<string, unknown>) {
    const indexId = input.index as string;
    const queryVector = input.query_vector as number[];
    const k = input.k as number;
    const diversity = input.diversity as number;

    let p = createProgram();
    p = find(p, 'vectors', { index_id: indexId }, 'allVectors');

    return branch(p,
      (bindings) => (bindings.allVectors as unknown[]).length === 0,
      complete(createProgram(), 'empty', { message: 'No results' }),
      (() => {
        let b = createProgram();
        b = find(b, 'vectors', { index_id: indexId }, 'allVectors');
        b = mapBindings(b, (bindings) => {
          const vecs = bindings.allVectors as Record<string, unknown>[];

          // Stub MMR: greedy selection balancing relevance and diversity
          const candidates = vecs.map(v => ({
            id: v.id as string,
            vector: v.vector as number[],
            score: cosineSimilarity(queryVector, v.vector as number[]),
            metadata: v.metadata as string | null,
          }));
          candidates.sort((a, b) => b.score - a.score);

          const selected: typeof candidates = [];
          const remaining = [...candidates];

          while (selected.length < k && remaining.length > 0) {
            if (selected.length === 0) {
              selected.push(remaining.shift()!);
              continue;
            }

            let bestIdx = 0;
            let bestMmr = -Infinity;
            for (let i = 0; i < remaining.length; i++) {
              const relevance = remaining[i].score;
              const maxSim = Math.max(...selected.map(s => cosineSimilarity(remaining[i].vector, s.vector)));
              const mmr = (1 - diversity) * relevance - diversity * maxSim;
              if (mmr > bestMmr) {
                bestMmr = mmr;
                bestIdx = i;
              }
            }
            selected.push(remaining.splice(bestIdx, 1)[0]);
          }

          return selected.map(s => ({ id: s.id, score: s.score, metadata: s.metadata }));
        }, 'results');

        return branch(b,
          (bindings) => (bindings.results as unknown[]).length === 0,
          complete(createProgram(), 'empty', { message: 'No results' }),
          completeFrom(createProgram(), 'ok', (bindings) => ({
            results: bindings.results as unknown[],
          })),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const indexId = input.index as string;
    const ids = input.ids as string[];

    let p = createProgram();
    let deletedCount = 0;

    for (const vecId of ids) {
      p = get(p, 'vectors', `${indexId}:${vecId}`, `check_${vecId}`);
    }

    // Simplified: delete all requested IDs, count successes
    for (const vecId of ids) {
      p = put(p, 'vectors', `${indexId}:${vecId}`, null as unknown as Record<string, unknown>);
      deletedCount++;
    }

    return complete(p, 'ok', { deleted: ids.length }) as StorageProgram<Result>;
  },
};

export const vectorIndexHandler = autoInterpret(_vectorIndexHandler);
