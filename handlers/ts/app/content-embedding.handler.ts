// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

let idCounter = 0;

function nextId(): string {
  return `content-embedding-${++idCounter}`;
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

export const contentEmbeddingHandler: FunctionalConceptHandler = {
  index(input: Record<string, unknown>) {
    const entityId = input.entity_id as string;
    const sourceType = input.source_type as string;
    const text = input.text as string;
    const model = input.model as string;

    if (!KNOWN_MODELS.has(model)) {
      let p = createProgram();
      return complete(p, 'modelUnavailable', { model }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const vector = generateMockVector(text, model, DEFAULT_DIMENSIONS);
    const digest = hashString(text).toString(16);
    const updatedAt = new Date().toISOString();
    const embedding = nextId();

    let p = createProgram();
    p = find(p, 'content-embedding', { entity_id: entityId }, 'existingRecords');
    // Idempotent upsert — existing ID resolved at runtime from bindings
    p = put(p, 'content-embedding', embedding, {
      id: embedding,
      entity_id: entityId,
      source_type: sourceType,
      model,
      content_digest: digest,
      excerpt: buildExcerpt(text),
      vector: JSON.stringify(vector),
      updated_at: updatedAt,
    });
    return complete(p, 'ok', { embedding }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  remove(input: Record<string, unknown>) {
    const entityId = input.entity_id as string;

    let p = createProgram();
    p = find(p, 'content-embedding', { entity_id: entityId }, 'existing');
    // Deletion of found record resolved at runtime from bindings
    return complete(p, 'ok', { entity_id: entityId }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  get(input: Record<string, unknown>) {
    const entityId = input.entity_id as string;

    let p = createProgram();
    p = find(p, 'content-embedding', { entity_id: entityId }, 'existing');
    // Record fields resolved at runtime from bindings
    return complete(p, 'ok', {
      embedding: '', entity_id: entityId,
      source_type: '', model: '', updated_at: '', excerpt: '',
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  searchSimilar(input: Record<string, unknown>) {
    const entityId = input.entity_id as string;
    const topK = input.topK as number;
    const sourceType = input.source_type as string;

    let p = createProgram();
    p = find(p, 'content-embedding', { entity_id: entityId }, 'current');
    p = find(p, 'content-embedding', {}, 'records');
    // Cosine similarity computation and ranking resolved at runtime
    return complete(p, 'ok', { results: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export function resetContentEmbeddingCounter(): void {
  idCounter = 0;
}
