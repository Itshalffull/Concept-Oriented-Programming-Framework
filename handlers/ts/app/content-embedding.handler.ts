import type { ConceptHandler, ConceptStorage } from '@clef/runtime';

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

async function findByEntityId(
  storage: ConceptStorage,
  entityId: string,
): Promise<Record<string, unknown> | null> {
  const records = await storage.find('content-embedding', { entity_id: entityId });
  if (!Array.isArray(records) || records.length === 0) {
    return null;
  }
  return records[0] as Record<string, unknown>;
}

export const contentEmbeddingHandler: ConceptHandler = {
  async index(input: Record<string, unknown>, storage: ConceptStorage) {
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
    const existing = await findByEntityId(storage, entityId);
    const embedding = (existing?.id as string | undefined) ?? nextId();

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

  async remove(input: Record<string, unknown>, storage: ConceptStorage) {
    const entityId = input.entity_id as string;
    const existing = await findByEntityId(storage, entityId);
    if (!existing) {
      return { variant: 'notfound', entity_id: entityId };
    }

    await storage.del('content-embedding', existing.id as string);
    return { variant: 'ok', entity_id: entityId };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const entityId = input.entity_id as string;
    const existing = await findByEntityId(storage, entityId);
    if (!existing) {
      return { variant: 'notfound', entity_id: entityId };
    }

    return {
      variant: 'ok',
      embedding: existing.id as string,
      entity_id: existing.entity_id as string,
      source_type: existing.source_type as string,
      model: existing.model as string,
      updated_at: existing.updated_at as string,
      excerpt: existing.excerpt as string,
    };
  },

  async searchSimilar(input: Record<string, unknown>, storage: ConceptStorage) {
    const entityId = input.entity_id as string;
    const topK = input.topK as number;
    const sourceType = input.source_type as string;

    const current = await findByEntityId(storage, entityId);
    if (!current) {
      return { variant: 'notfound', entity_id: entityId };
    }

    const currentVector = JSON.parse(current.vector as string) as number[];
    const records = await storage.find('content-embedding');
    const candidates = (Array.isArray(records) ? records : [])
      .filter((record) => record.entity_id !== entityId)
      .filter((record) => !sourceType || record.source_type === sourceType)
      .map((record) => {
        const vector = JSON.parse(record.vector as string) as number[];
        return {
          entity_id: record.entity_id as string,
          score: cosineSimilarity(currentVector, vector),
          source_type: record.source_type as string,
          excerpt: record.excerpt as string,
          model: record.model as string,
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, topK > 0 ? topK : undefined);

    if (candidates.length === 0) {
      return { variant: 'empty', message: 'No similar entities matched the current scope.' };
    }

    return { variant: 'ok', results: JSON.stringify(candidates) };
  },
};

export function resetContentEmbeddingCounter(): void {
  idCounter = 0;
}
