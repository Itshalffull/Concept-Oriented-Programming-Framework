// ============================================================
// SemanticEmbedding Handler
//
// Vector representation of DefinitionUnits for similarity search
// and natural language code search. Cached by content digest so
// embeddings are recomputed only when the underlying code changes.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

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
 * Used to seed deterministic mock embeddings from content.
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
 * The vector is unit-normalised so cosine similarity behaves correctly.
 */
function generateMockVector(content: string, model: string, dims: number): number[] {
  const seed = hashString(content + '::' + model);
  const raw: number[] = [];
  let s = seed;
  for (let i = 0; i < dims; i++) {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    raw.push(((s >>> 0) / 0xffffffff) * 2 - 1);
  }
  // Normalise to unit length
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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const semanticEmbeddingHandler: ConceptHandler = {
  async compute(input: Record<string, unknown>, storage: ConceptStorage) {
    const unit = input.unit as string;
    const model = input.model as string;

    if (!KNOWN_MODELS.has(model)) {
      return { variant: 'modelUnavailable', model };
    }

    const dimensions = DEFAULT_DIMENSIONS;
    const vector = generateMockVector(unit, model, dimensions);
    const digest = hashString(unit).toString(16);

    const id = nextId();
    await storage.put('semantic-embedding', id, {
      id,
      unit,
      digest,
      model,
      vector: JSON.stringify(vector),
      dimensions,
    });

    return { variant: 'ok', embedding: id };
  },

  async searchSimilar(input: Record<string, unknown>, storage: ConceptStorage) {
    const queryVector = input.queryVector as string;
    const topK = input.topK as number;
    const language = input.language as string;
    const kind = input.kind as string;

    const qVec: number[] = JSON.parse(queryVector);

    const allEmbeddings = await storage.find('semantic-embedding');

    const scored: Array<{ unit: string; score: number }> = [];
    for (const rec of allEmbeddings) {
      const storedVec: number[] = JSON.parse(rec.vector as string);
      const score = cosineSimilarity(qVec, storedVec);
      scored.push({ unit: rec.unit as string, score });
    }

    // Sort descending by score and take topK
    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, topK > 0 ? topK : scored.length);

    return { variant: 'ok', results: JSON.stringify(results) };
  },

  async searchNaturalLanguage(input: Record<string, unknown>, storage: ConceptStorage) {
    const query = input.query as string;
    const topK = input.topK as number;

    // Embed the natural language query using a default model
    const qVec = generateMockVector(query, 'openai-code', DEFAULT_DIMENSIONS);

    const allEmbeddings = await storage.find('semantic-embedding');

    const scored: Array<{ unit: string; score: number }> = [];
    for (const rec of allEmbeddings) {
      const storedVec: number[] = JSON.parse(rec.vector as string);
      const score = cosineSimilarity(qVec, storedVec);
      scored.push({ unit: rec.unit as string, score });
    }

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, topK > 0 ? topK : scored.length);

    return { variant: 'ok', results: JSON.stringify(results) };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const embedding = input.embedding as string;

    const record = await storage.get('semantic-embedding', embedding);
    if (!record) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      embedding: record.id as string,
      unit: record.unit as string,
      model: record.model as string,
      dimensions: record.dimensions as number,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSemanticEmbeddingCounter(): void {
  idCounter = 0;
}
