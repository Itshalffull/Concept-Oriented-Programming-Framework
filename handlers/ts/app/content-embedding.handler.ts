// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
//
// Uses imperative style because index/remove/get/searchSimilar require
// conditional logic with dynamic storage keys from find results.
import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

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

type Result = { variant: string; [key: string]: unknown };

const _contentEmbeddingHandler: ConceptHandler = {
  async index(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const entityId = input.entity_id as string;
    const sourceType = input.source_type as string;
    const text = input.text as string;
    const model = input.model as string;

    if (!KNOWN_MODELS.has(model)) {
      return { variant: 'modelUnavailable', model };
    }

    const vector = generateMockVector(text, model, DEFAULT_DIMENSIONS);
    const digest = hashString(text).toString(16);
    const updatedAt = new Date().toISOString();

    // Check for existing embedding for this entity (idempotent upsert)
    const existing = await storage.find('content-embedding', { entity_id: entityId });

    let embedding: string;
    if (existing.length > 0) {
      embedding = existing[0].id as string;
    } else {
      embedding = nextId();
    }

    await storage.put('content-embedding', embedding, {
      id: embedding,
      entity_id: entityId,
      source_type: sourceType,
      model,
      content_digest: digest,
      excerpt: buildExcerpt(text),
      vector: JSON.stringify(vector),
      updated_at: updatedAt,
    });

    return { variant: 'ok', embedding };
  },

  async remove(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const entityId = input.entity_id as string;

    const existing = await storage.find('content-embedding', { entity_id: entityId });
    for (const record of existing) {
      await storage.del('content-embedding', record.id as string);
    }

    return { variant: 'ok', entity_id: entityId };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const entityId = input.entity_id as string;

    const existing = await storage.find('content-embedding', { entity_id: entityId });
    if (existing.length === 0) {
      return { variant: 'notfound', entity_id: entityId };
    }

    const rec = existing[0];
    return {
      variant: 'ok',
      embedding: rec.id as string,
      entity_id: entityId,
      source_type: rec.source_type as string,
      model: rec.model as string,
      updated_at: rec.updated_at as string,
      excerpt: rec.excerpt as string,
    };
  },

  async searchSimilar(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const entityId = input.entity_id as string;
    const topK = input.topK as number;
    const sourceType = input.source_type as string;

    // Get current entity's embedding
    const current = await storage.find('content-embedding', { entity_id: entityId });
    if (current.length === 0) {
      return { variant: 'notfound', entity_id: entityId };
    }

    const currentVector = JSON.parse(current[0].vector as string) as number[];

    // Get all embeddings
    const allRecords = await storage.find('content-embedding', {});

    // Compute similarities
    const scored: Array<{ entity_id: string; similarity: number }> = [];
    for (const rec of allRecords) {
      const recEntityId = rec.entity_id as string;
      if (recEntityId === entityId) continue;
      if (sourceType && rec.source_type !== sourceType) continue;

      const vector = JSON.parse(rec.vector as string) as number[];
      const similarity = cosineSimilarity(currentVector, vector);
      scored.push({ entity_id: recEntityId, similarity });
    }

    // Sort by similarity descending and take top K
    scored.sort((a, b) => b.similarity - a.similarity);
    const results = scored.slice(0, topK);

    return { variant: 'ok', results: JSON.stringify(results) };
  },
};

export const contentEmbeddingHandler = _contentEmbeddingHandler;


export function resetContentEmbeddingCounter(): void {
  idCounter = 0;
}
