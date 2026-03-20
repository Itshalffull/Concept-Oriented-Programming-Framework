// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SemanticEmbedding Handler
//
// Vector representation of DefinitionUnits for similarity search
// and natural language code search. Cached by content digest so
// embeddings are recomputed only when the underlying code changes.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `semantic-embedding-${++idCounter}`;
}

// ---------------------------------------------------------------------------
// Deterministic mock embedding generator
// ---------------------------------------------------------------------------

const DEFAULT_DIMENSIONS = 128;

/**
 * Simple string hash producing a 32-bit unsigned integer.
 */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/**
 * Generate a deterministic float vector from a content string and model name.
 */
function generateMockVector(content: string, model: string, dims: number): number[] {
  const seed = hashString(content + '::' + model);
  const raw: number[] = [];
  let s = seed;
  for (let i = 0; i < dims; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    raw.push(((s >>> 0) / 0xffffffff) * 2 - 1);
  }
  const mag = Math.sqrt(raw.reduce((sum, v) => sum + v * v, 0)) || 1;
  return raw.map((v) => v / mag);
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Known embedding model names
// ---------------------------------------------------------------------------

const KNOWN_MODELS = new Set([
  'codeBERT',
  'unixcoder',
  'openai-code',
  'voyage-code',
]);

const _handler: FunctionalConceptHandler = {
  compute(input: Record<string, unknown>) {
    const unit = input.unit as string;
    const model = input.model as string;

    if (!KNOWN_MODELS.has(model)) {
      const p = createProgram();
      return complete(p, 'modelUnavailable', { model }) as StorageProgram<Result>;
    }

    const dimensions = DEFAULT_DIMENSIONS;
    const vector = generateMockVector(unit, model, dimensions);
    const digest = hashString(unit).toString(16);

    const id = nextId();
    let p = createProgram();
    p = put(p, 'semantic-embedding', id, {
      id,
      unit,
      digest,
      model,
      vector: JSON.stringify(vector),
      dimensions,
    });

    return complete(p, 'ok', { embedding: id }) as StorageProgram<Result>;
  },

  searchSimilar(input: Record<string, unknown>) {
    const queryVector = input.queryVector as string;
    const topK = input.topK as number;

    const qVec: number[] = JSON.parse(queryVector);

    let p = createProgram();
    p = find(p, 'semantic-embedding', {}, 'allEmbeddings');

    return completeFrom(p, 'ok', (bindings) => {
      const allEmbeddings = bindings.allEmbeddings as Record<string, unknown>[];

      const scored: Array<{ unit: string; score: number }> = [];
      for (const rec of allEmbeddings) {
        const storedVec: number[] = JSON.parse(rec.vector as string);
        const score = cosineSimilarity(qVec, storedVec);
        scored.push({ unit: rec.unit as string, score });
      }

      scored.sort((a, b) => b.score - a.score);
      const results = scored.slice(0, topK > 0 ? topK : scored.length);

      return { results: JSON.stringify(results) };
    }) as StorageProgram<Result>;
  },

  searchNaturalLanguage(input: Record<string, unknown>) {
    const query = input.query as string;
    const topK = input.topK as number;

    const qVec = generateMockVector(query, 'openai-code', DEFAULT_DIMENSIONS);

    let p = createProgram();
    p = find(p, 'semantic-embedding', {}, 'allEmbeddings');

    return completeFrom(p, 'ok', (bindings) => {
      const allEmbeddings = bindings.allEmbeddings as Record<string, unknown>[];

      const scored: Array<{ unit: string; score: number }> = [];
      for (const rec of allEmbeddings) {
        const storedVec: number[] = JSON.parse(rec.vector as string);
        const score = cosineSimilarity(qVec, storedVec);
        scored.push({ unit: rec.unit as string, score });
      }

      scored.sort((a, b) => b.score - a.score);
      const results = scored.slice(0, topK > 0 ? topK : scored.length);

      return { results: JSON.stringify(results) };
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const embedding = input.embedding as string;

    let p = createProgram();
    p = get(p, 'semantic-embedding', embedding, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            embedding: record.id as string,
            unit: record.unit as string,
            model: record.model as string,
            dimensions: record.dimensions as number,
          };
        });
      },
      (elseP) => complete(elseP, 'notfound', {}),
    ) as StorageProgram<Result>;
  },
};

export const semanticEmbeddingHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSemanticEmbeddingCounter(): void {
  idCounter = 0;
}
