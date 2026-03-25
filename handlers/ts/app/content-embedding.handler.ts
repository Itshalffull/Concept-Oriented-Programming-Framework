// @clef-handler style=functional
// ContentEmbedding Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, putFrom, branch, complete, completeFrom,
  mapBindings, traverse, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let idCounter = 0;

function nextId(): string {
  return `content-embedding-${++idCounter}`;
}

export function resetContentEmbeddingCounter(): void {
  idCounter = 0;
}

const DEFAULT_DIMENSIONS = 128;
const KNOWN_MODELS = new Set([
  'text-embedding-3-small',
  'text-embedding-3-large',
  'openai-code',
  'voyage-code',
  'codeBERT',
  'unixcoder',
]);

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }
  return hash >>> 0;
}

function generateMockVector(content: string, model: string, dims: number): number[] {
  const seed = hashString(`${content}::${model}`);
  const raw: number[] = [];
  let state = seed;
  for (let index = 0; index < dims; index++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    raw.push(((state >>> 0) / 0xffffffff) * 2 - 1);
  }
  const magnitude = Math.sqrt(raw.reduce((sum, value) => sum + value * value, 0)) || 1;
  return raw.map((value) => value / magnitude);
}

function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < length; index++) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator === 0 ? 0 : dot / denominator;
}

function buildExcerpt(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
}

type R = StorageProgram<{ variant: string; [key: string]: unknown }>;

const _handler: FunctionalConceptHandler = {
  index(input: Record<string, unknown>): R {
    const entityId = input.entity_id as string;
    const sourceType = input.source_type as string;
    const text = input.text as string;
    const model = input.model as string;

    if (!KNOWN_MODELS.has(model)) {
      return complete(createProgram(), 'modelUnavailable', { model }) as R;
    }

    const vector = generateMockVector(text, model, DEFAULT_DIMENSIONS);
    const digest = hashString(text).toString(16);
    const updatedAt = new Date().toISOString();
    const excerpt = buildExcerpt(text);

    let p = createProgram();
    p = find(p, 'content-embedding', { entity_id: entityId }, 'existing');
    // Determine the embedding key: reuse existing or generate new
    p = mapBindings(p, (bindings) => {
      const existing = bindings.existing as Array<Record<string, unknown>>;
      return existing.length > 0 ? existing[0].id as string : nextId();
    }, 'embeddingKey');
    // Use a placeholder key in putFrom — the actual key comes from bindings
    p = mapBindings(p, (bindings) => ({
      id: bindings.embeddingKey,
      entity_id: entityId,
      source_type: sourceType,
      model,
      content_digest: digest,
      excerpt,
      vector: JSON.stringify(vector),
      updated_at: updatedAt,
    }), 'embeddingRecord');
    return completeFrom(p, 'ok', (bindings) => {
      const key = bindings.embeddingKey as string;
      const record = bindings.embeddingRecord as Record<string, unknown>;
      // Side-effect via putFrom is not feasible with dynamic keys via mapBindings,
      // so we embed the record in the output for the autoInterpret override below.
      return { _embeddingKey: key, _embeddingRecord: record, embedding: key, output: { embedding: key } };
    }) as R;
  },

  remove(input: Record<string, unknown>): R {
    const entityId = input.entity_id as string;

    if (!entityId || typeof entityId !== 'string' || entityId.trim() === '') {
      return complete(createProgram(), 'notfound', { entity_id: entityId }) as R;
    }

    let p = createProgram();
    p = find(p, 'content-embedding', { entity_id: entityId }, 'byEntityId');
    p = get(p, 'content-embedding', entityId, 'byId');
    p = mapBindings(p, (bindings) => {
      const byEntityId = bindings.byEntityId as Array<Record<string, unknown>>;
      const byId = bindings.byId as Record<string, unknown> | null;
      if (byEntityId.length > 0) return byEntityId;
      if (byId) return [byId];
      return [];
    }, 'records');
    return branch(p, (b) => (b.records as unknown[]).length > 0,
      (b) => {
        // traverse to delete each record
        let b2 = traverse(b, 'records', '_rec', (item) => {
          const rec = item as Record<string, unknown>;
          const key = rec.id as string;
          let s = createProgram();
          s = del(s, 'content-embedding', key);
          return complete(s, 'deleted', {});
        }, '_deleteResults', {
          writes: ['content-embedding'],
          completionVariants: ['deleted'],
        });
        return complete(b2, 'ok', { entity_id: entityId });
      },
      (b) => complete(b, 'notfound', { entity_id: entityId }),
    ) as R;
  },

  get(input: Record<string, unknown>): R {
    const entityId = input.entity_id as string;

    let p = createProgram();
    p = find(p, 'content-embedding', { entity_id: entityId }, 'byEntityId');
    p = get(p, 'content-embedding', entityId, 'byId');
    p = mapBindings(p, (bindings) => {
      const byEntityId = bindings.byEntityId as Array<Record<string, unknown>>;
      const byId = bindings.byId as Record<string, unknown> | null;
      if (byEntityId.length > 0) return byEntityId[0];
      if (byId) return byId;
      return null;
    }, 'record');
    return branch(p, 'record',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return {
            embedding: rec.id as string,
            entity_id: (rec.entity_id as string) || entityId,
            source_type: rec.source_type as string,
            model: rec.model as string,
            updated_at: rec.updated_at as string,
            excerpt: rec.excerpt as string,
          };
        });
      },
      (b) => complete(b, 'notfound', { entity_id: entityId }),
    ) as R;
  },

  searchSimilar(input: Record<string, unknown>): R {
    const entityId = input.entity_id as string;
    const topK = input.topK as number;
    const sourceType = input.source_type as string;

    let p = createProgram();
    p = find(p, 'content-embedding', { entity_id: entityId }, 'byEntityId');
    p = get(p, 'content-embedding', entityId, 'byId');
    p = mapBindings(p, (bindings) => {
      const byEntityId = bindings.byEntityId as Array<Record<string, unknown>>;
      const byId = bindings.byId as Record<string, unknown> | null;
      if (byEntityId.length > 0) return byEntityId[0];
      if (byId) return byId;
      return null;
    }, 'current');
    p = find(p, 'content-embedding', {}, 'allRecords');
    return branch(p, 'current',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const current = bindings.current as Record<string, unknown>;
          const allRecords = bindings.allRecords as Array<Record<string, unknown>>;
          const currentVector = JSON.parse(current.vector as string) as number[];

          const scored: Array<{ entity_id: string; similarity: number }> = [];
          for (const rec of allRecords) {
            const recEntityId = rec.entity_id as string;
            if (recEntityId === entityId) continue;
            if (sourceType && rec.source_type !== sourceType) continue;
            const vector = JSON.parse(rec.vector as string) as number[];
            const similarity = cosineSimilarity(currentVector, vector);
            scored.push({ entity_id: recEntityId, similarity });
          }

          scored.sort((a, b) => b.similarity - a.similarity);
          const results = scored.slice(0, topK);
          return { results: JSON.stringify(results) };
        });
      },
      (b) => complete(b, 'notfound', { entity_id: entityId }),
    ) as R;
  },
};

// autoInterpret wraps the functional handler so it works with both
// (input) → StorageProgram and (input, storage) → Promise<result> calling conventions.
// The `index` action requires a dynamic storage key from bindings; we override it
// with an imperative fallback that interprets the functional program first to
// determine the embedding key, then writes the record directly.
const _base = autoInterpret(_handler);

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

export const contentEmbeddingHandler: typeof _base = {
  ..._base,
  async index(input: Record<string, unknown>, storage?: ConceptStorage) {
    if (!storage) {
      // Functional mode: return raw program
      return _handler.index(input) as unknown as ReturnType<typeof _base.index>;
    }
    // Imperative compat mode: interpret the program to get the embedding key, then write
    const entityId = input.entity_id as string;
    const sourceType = input.source_type as string;
    const text = input.text as string;
    const model = input.model as string;

    if (!KNOWN_MODELS.has(model)) {
      return { variant: 'modelUnavailable', model } as unknown as ReturnType<typeof _base.index>;
    }

    const vector = generateMockVector(text, model, DEFAULT_DIMENSIONS);
    const digest = hashString(text).toString(16);
    const updatedAt = new Date().toISOString();
    const excerpt = buildExcerpt(text);

    const existingRecords = await storage.find('content-embedding', { entity_id: entityId });
    const embeddingKey = existingRecords.length > 0 ? existingRecords[0].id as string : nextId();

    await storage.put('content-embedding', embeddingKey, {
      id: embeddingKey,
      entity_id: entityId,
      source_type: sourceType,
      model,
      content_digest: digest,
      excerpt,
      vector: JSON.stringify(vector),
      updated_at: updatedAt,
    });

    return { variant: 'ok', embedding: embeddingKey, output: { embedding: embeddingKey } } as unknown as ReturnType<typeof _base.index>;
  },
} as typeof _base;
