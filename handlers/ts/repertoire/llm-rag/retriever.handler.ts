// @clef-handler style=functional
// ============================================================
// Retriever Concept Implementation
//
// RAG orchestration layer. Takes natural-language queries, finds
// relevant content, prepares for LLM consumption. Multi-stage
// pipeline: first-stage retrieval, re-ranking, compression.
// Supports multi-query expansion, self-query metadata filtering,
// contextual compression, and hierarchical retrieval.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_TYPES = [
  'vector', 'multi_query', 'self_query', 'parent_document',
  'ensemble', 'contextual_compression', 'recursive',
];

let _retrieverCounter = 0;
function generateRetrieverId(): string {
  return `ret-${Date.now()}-${++_retrieverCounter}`;
}

/**
 * Stub similarity scoring. Production would call the VectorIndex concept
 * via syncs and use actual embeddings.
 */
function stubScore(query: string, content: string): number {
  const qWords = new Set(query.toLowerCase().split(/\s+/));
  const cWords = content.toLowerCase().split(/\s+/);
  const overlap = cWords.filter(w => qWords.has(w)).length;
  return Math.min(1.0, overlap / Math.max(qWords.size, 1));
}

const _retrieverHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const retrieverType = input.retriever_type as string;
    const sourceIds = input.source_ids as string[];
    const topK = input.top_k as number;
    const scoreThreshold = (input.score_threshold as number | null) ?? null;

    if (!retrieverType || retrieverType.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'retriever_type is required' }) as StorageProgram<Result>;
    }

    if (!VALID_TYPES.includes(retrieverType)) {
      return complete(createProgram(), 'invalid', { message: `Unknown type: ${retrieverType}` }) as StorageProgram<Result>;
    }

    const id = generateRetrieverId();
    let p = createProgram();
    p = put(p, 'retrievers', id, {
      id,
      retriever_type: retrieverType,
      source_ids: sourceIds,
      top_k: topK,
      reranker_config: null,
      filters: null,
      score_threshold: scoreThreshold,
    });

    return complete(p, 'ok', { retriever: id }) as StorageProgram<Result>;
  },

  retrieve(input: Record<string, unknown>) {
    const retrieverId = input.retriever as string;
    const query = input.query as string;

    let p = createProgram();
    p = get(p, 'retrievers', retrieverId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'empty', { message: 'Retriever not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'retrievers', retrieverId, 'existing');
        b = mapBindings(b, (bindings) => {
          const ret = bindings.existing as Record<string, unknown>;
          const topK = ret.top_k as number;
          const threshold = ret.score_threshold as number | null;

          // Stub: generate placeholder documents based on source_ids
          const sourceIds = ret.source_ids as string[];
          const docs = sourceIds.map((sid, i) => ({
            id: `${sid}-doc-${i}`,
            content: `Content from source ${sid} relevant to: ${query}`,
            score: Math.max(0.1, 1.0 - i * 0.15),
            metadata: null,
          }));

          let filtered = docs;
          if (threshold != null) {
            filtered = docs.filter(d => d.score >= threshold);
          }

          return filtered.slice(0, topK);
        }, 'documents');

        return branch(b,
          (bindings) => (bindings.documents as unknown[]).length === 0,
          complete(createProgram(), 'empty', { message: 'No relevant documents' }),
          completeFrom(createProgram(), 'ok', (bindings) => ({
            documents: bindings.documents as unknown[],
          })),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  multiQueryRetrieve(input: Record<string, unknown>) {
    const retrieverId = input.retriever as string;
    const query = input.query as string;

    let p = createProgram();
    p = get(p, 'retrievers', retrieverId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'empty', { message: 'Retriever not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'retrievers', retrieverId, 'existing');
        b = mapBindings(b, (bindings) => {
          const ret = bindings.existing as Record<string, unknown>;
          const topK = ret.top_k as number;

          // Stub: simulate multi-query expansion with reciprocal rank fusion
          const variations = [query, `${query} explained`, `What is ${query}?`];
          const seen = new Set<string>();
          const docs: { id: string; content: string; score: number }[] = [];

          for (const q of variations) {
            const docId = `mq-${q.length}-${docs.length}`;
            if (!seen.has(docId)) {
              seen.add(docId);
              docs.push({
                id: docId,
                content: `Multi-query result for: ${q}`,
                score: Math.max(0.3, 1.0 - docs.length * 0.1),
              });
            }
          }

          return docs.slice(0, topK);
        }, 'documents');

        return branch(b,
          (bindings) => (bindings.documents as unknown[]).length === 0,
          complete(createProgram(), 'empty', { message: 'No results' }),
          completeFrom(createProgram(), 'ok', (bindings) => ({
            documents: bindings.documents as unknown[],
          })),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  selfQueryRetrieve(input: Record<string, unknown>) {
    const retrieverId = input.retriever as string;
    const query = input.query as string;

    let p = createProgram();
    p = get(p, 'retrievers', retrieverId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'empty', { message: 'Retriever not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'retrievers', retrieverId, 'existing');
        b = mapBindings(b, (bindings) => {
          const ret = bindings.existing as Record<string, unknown>;
          const topK = ret.top_k as number;

          // Stub: simulate LLM-extracted filters from natural language
          const extractedFilters = JSON.stringify({ topic: query.split(' ')[0] });
          const docs = [{
            id: `sq-0`,
            content: `Self-query result for: ${query}`,
            score: 0.85,
          }];

          return { docs: docs.slice(0, topK), filters: extractedFilters };
        }, 'result');

        return branch(b,
          (bindings) => {
            const r = bindings.result as { docs: unknown[] };
            return r.docs.length === 0;
          },
          complete(createProgram(), 'empty', { message: 'No results' }),
          completeFrom(createProgram(), 'ok', (bindings) => {
            const r = bindings.result as { docs: unknown[]; filters: string };
            return { documents: r.docs, extracted_filters: r.filters };
          }),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  rerank(input: Record<string, unknown>) {
    const retrieverId = input.retriever as string;
    const query = input.query as string;
    const documents = input.documents as { id: string; content: string }[];

    let p = createProgram();
    p = get(p, 'retrievers', retrieverId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Reranker unavailable' }),
      (() => {
        let b = createProgram();
        b = get(b, 'retrievers', retrieverId, 'existing');
        b = mapBindings(b, (bindings) => {
          const ret = bindings.existing as Record<string, unknown>;
          const rerankerConfig = ret.reranker_config as { model: string; top_n: number } | null;
          const topN = rerankerConfig?.top_n ?? documents.length;

          // Stub: re-score using simple overlap
          const reranked = documents
            .map(doc => ({
              id: doc.id,
              content: doc.content,
              score: stubScore(query, doc.content),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topN);

          return reranked;
        }, 'reranked');

        return completeFrom(b, 'ok', (bindings) => ({
          reranked: bindings.reranked as unknown[],
        }));
      })(),
    ) as StorageProgram<Result>;
  },

  compress(input: Record<string, unknown>) {
    const retrieverId = input.retriever as string;
    const query = input.query as string;
    const documents = input.documents as { id: string; content: string }[];

    let p = createProgram();
    p = get(p, 'retrievers', retrieverId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Compression failed' }),
      (() => {
        // Stub: simulate contextual compression by truncating content
        const compressed = documents.map(doc => ({
          id: doc.id,
          content: doc.content.slice(0, Math.ceil(doc.content.length * 0.6)),
          original_length: doc.content.length,
          compressed_length: Math.ceil(doc.content.length * 0.6),
        }));

        return complete(createProgram(), 'ok', { compressed }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  setReranker(input: Record<string, unknown>) {
    const retrieverId = input.retriever as string;
    const model = input.model as string;
    const topN = input.top_n as number;

    if (!model || model.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'Unknown model' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'retrievers', retrieverId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'invalid', { message: 'Retriever not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'retrievers', retrieverId, 'existing');
        b = putFrom(b, 'retrievers', retrieverId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, reranker_config: { model, top_n: topN } };
        });
        return complete(b, 'ok', { retriever: retrieverId });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const retrieverHandler = autoInterpret(_retrieverHandler);
