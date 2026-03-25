// @clef-handler style=functional
// FewShotExample Concept Implementation
// Manages pools of input-output examples and selects the most effective
// subset for each prompt at runtime using configurable selection strategies.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
let exampleIdCounter = 0;

function nextPoolId(): string {
  return `few-shot-pool-${++idCounter}`;
}

function nextExampleId(): string {
  return `example-${++exampleIdCounter}`;
}

const VALID_STRATEGIES = new Set([
  'semantic_similarity', 'mmr', 'ngram_overlap', 'length_based', 'random', 'bootstrapped',
]);

/** Simple n-gram overlap score between two strings. */
function ngramOverlap(a: string, b: string, n = 2): number {
  const ngrams = (s: string) => {
    const tokens = s.toLowerCase().split(/\s+/);
    const grams = new Set<string>();
    for (let i = 0; i <= tokens.length - n; i++) {
      grams.add(tokens.slice(i, i + n).join(' '));
    }
    return grams;
  };
  const aG = ngrams(a);
  const bG = ngrams(b);
  if (aG.size === 0 || bG.size === 0) return 0;
  let intersection = 0;
  for (const g of aG) {
    if (bG.has(g)) intersection++;
  }
  return intersection / Math.max(aG.size, bG.size);
}

/** Cosine similarity between two float vectors. */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'FewShotExample' }) as StorageProgram<Result>;
  },

  createPool(input: Record<string, unknown>) {
    const strategy = input.strategy as string;
    const k = input.k as number;
    const diversityWeight = input.diversity_weight as number;

    if (!strategy || strategy.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'strategy is required' }) as StorageProgram<Result>;
    }
    if (!VALID_STRATEGIES.has(strategy)) {
      return complete(createProgram(), 'invalid', { message: `Unknown strategy: ${strategy}` }) as StorageProgram<Result>;
    }

    const id = nextPoolId();
    let p = createProgram();
    p = put(p, 'pool', id, {
      id,
      selection_strategy: strategy,
      k: k ?? 3,
      diversity_weight: diversityWeight ?? 0.5,
      examples: [],
      quality_scores: [],
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { pool: id }) as StorageProgram<Result>;
  },

  add(input: Record<string, unknown>) {
    const pool = input.pool as string;
    const exInput = input.input as string;
    const output = input.output as string;
    const metadata = input.metadata as string | null;

    if (!pool || pool.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'pool is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'pool', pool, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Pool not found' }),
      (() => {
        const exampleId = nextExampleId();
        let b = createProgram();
        b = get(b, 'pool', pool, 'rec');
        b = putFrom(b, 'pool', pool, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const examples = (rec.examples as unknown[]) || [];
          const newExample = {
            id: exampleId,
            input: exInput,
            output,
            metadata: metadata ?? null,
            embedding: null,
          };
          return { ...rec, examples: [...examples, newExample] };
        });
        return complete(b, 'ok', { example_id: exampleId });
      })(),
    ) as StorageProgram<Result>;
  },

  select(input: Record<string, unknown>) {
    const pool = input.pool as string;
    const queryInput = input.input as string;
    const kOverride = input.k as number | null;

    if (!pool || pool.trim() === '') {
      return complete(createProgram(), 'empty', { message: 'pool is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'pool', pool, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'empty', { message: 'Pool not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'pool', pool, 'rec');
        b = mapBindings(b, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const examples = (rec.examples as Array<Record<string, unknown>>) || [];
          return examples.length;
        }, '_count');
        return branch(b,
          (bindings) => (bindings._count as number) === 0,
          complete(createProgram(), 'empty', { message: 'Pool has no examples' }),
          (() => {
            let c = createProgram();
            c = get(c, 'pool', pool, 'poolRec');
            return completeFrom(c, 'ok', (bindings) => {
              const rec = bindings.poolRec as Record<string, unknown>;
              const examples = (rec.examples as Array<Record<string, unknown>>) || [];
              const strategy = rec.selection_strategy as string;
              const k = kOverride ?? (rec.k as number) ?? 3;
              const diversityWeight = rec.diversity_weight as number ?? 0.5;

              let scored: Array<{ input: string; output: string; score: number }> = [];

              if (strategy === 'semantic_similarity' || strategy === 'mmr') {
                // Use embeddings if available, otherwise fall back to n-gram overlap
                scored = examples.map((ex) => {
                  const embedding = ex.embedding as number[] | null;
                  let score = 0;
                  if (embedding && embedding.length > 0) {
                    // Would need query embedding — approximate with length similarity
                    score = 1 / (1 + Math.abs(embedding.length - queryInput.length));
                  } else {
                    score = ngramOverlap(queryInput, ex.input as string);
                  }
                  return { input: ex.input as string, output: ex.output as string, score };
                });

                if (strategy === 'mmr') {
                  // Maximal marginal relevance: balance relevance and diversity
                  const selected: typeof scored = [];
                  const remaining = [...scored];
                  while (selected.length < k && remaining.length > 0) {
                    let bestIdx = 0;
                    let bestScore = -Infinity;
                    for (let i = 0; i < remaining.length; i++) {
                      const relevance = remaining[i].score;
                      const maxSim = selected.length === 0 ? 0 :
                        Math.max(...selected.map((s) => ngramOverlap(s.input, remaining[i].input)));
                      const mmrScore = diversityWeight * relevance - (1 - diversityWeight) * maxSim;
                      if (mmrScore > bestScore) {
                        bestScore = mmrScore;
                        bestIdx = i;
                      }
                    }
                    selected.push(remaining[bestIdx]);
                    remaining.splice(bestIdx, 1);
                  }
                  return { examples: selected.slice(0, k) };
                }
              } else if (strategy === 'ngram_overlap') {
                scored = examples.map((ex) => ({
                  input: ex.input as string,
                  output: ex.output as string,
                  score: ngramOverlap(queryInput, ex.input as string),
                }));
              } else if (strategy === 'length_based') {
                const targetLen = queryInput.length;
                scored = examples.map((ex) => ({
                  input: ex.input as string,
                  output: ex.output as string,
                  score: 1 / (1 + Math.abs((ex.input as string).length - targetLen)),
                }));
              } else if (strategy === 'bootstrapped') {
                // Use quality scores if available
                const qScores = (rec.quality_scores as Array<{ id: string; score: number }>) || [];
                const scoreMap = new Map(qScores.map((q) => [q.id, q.score]));
                scored = examples.map((ex) => ({
                  input: ex.input as string,
                  output: ex.output as string,
                  score: scoreMap.get(ex.id as string) ?? 0.5,
                }));
              } else {
                // Random
                scored = examples.map((ex) => ({
                  input: ex.input as string,
                  output: ex.output as string,
                  score: Math.random(),
                }));
              }

              scored.sort((a, b) => b.score - a.score);
              return { examples: scored.slice(0, k) };
            });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  optimize(input: Record<string, unknown>) {
    const pool = input.pool as string;
    const metric = input.metric as string;
    const trainingSet = input.training_set as Array<{ input: string; expected: string }>;

    if (!pool || pool.trim() === '') {
      return complete(createProgram(), 'error', { message: 'pool is required' }) as StorageProgram<Result>;
    }
    if (!trainingSet || !Array.isArray(trainingSet) || trainingSet.length === 0) {
      return complete(createProgram(), 'error', { message: 'training_set is required and must be non-empty' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'pool', pool, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Pool not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'pool', pool, 'rec');
        b = putFrom(b, 'pool', pool, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const examples = (rec.examples as Array<Record<string, unknown>>) || [];

          // Simulate bootstrapping: score each example against training set
          const qualityScores = examples.map((ex) => {
            // Heuristic: examples closer to training inputs score higher
            const avgOverlap = trainingSet.reduce((sum, t) =>
              sum + ngramOverlap(ex.input as string, t.input), 0) / trainingSet.length;
            return { id: ex.id as string, score: avgOverlap };
          });

          return { ...rec, quality_scores: qualityScores };
        });
        b = get(b, 'pool', pool, 'recUpdated');
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.recUpdated as Record<string, unknown>;
          const examples = (rec.examples as Array<Record<string, unknown>>) || [];
          const qScores = (rec.quality_scores as Array<{ id: string; score: number }>) || [];
          const avgScore = qScores.length > 0
            ? qScores.reduce((sum, q) => sum + q.score, 0) / qScores.length
            : 0;
          return { optimized_count: examples.length, avg_score: avgScore };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  embed(input: Record<string, unknown>) {
    const pool = input.pool as string;
    const modelId = input.model_id as string;

    if (!pool || pool.trim() === '') {
      return complete(createProgram(), 'error', { message: 'pool is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'pool', pool, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Embedding model unavailable' }),
      (() => {
        let b = createProgram();
        b = get(b, 'pool', pool, 'rec');
        b = putFrom(b, 'pool', pool, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const examples = (rec.examples as Array<Record<string, unknown>>) || [];
          // Generate mock embeddings (real implementation would call embedding API via perform())
          const embedded = examples.map((ex) => ({
            ...ex,
            embedding: Array.from({ length: 128 }, () => Math.random() * 2 - 1),
          }));
          return { ...rec, examples: embedded };
        });
        b = get(b, 'pool', pool, 'recEmbedded');
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.recEmbedded as Record<string, unknown>;
          const examples = (rec.examples as Array<Record<string, unknown>>) || [];
          return { embedded_count: examples.length };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const pool = input.pool as string;
    const exampleId = input.example_id as string;

    if (!pool || pool.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'pool is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'pool', pool, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Pool not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'pool', pool, 'rec');
        b = mapBindings(b, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const examples = (rec.examples as Array<Record<string, unknown>>) || [];
          return examples.some((e) => e.id === exampleId);
        }, '_found');
        return branch(b,
          (bindings) => !bindings._found,
          complete(createProgram(), 'notfound', { message: 'Example not found' }),
          (() => {
            let c = createProgram();
            c = get(c, 'pool', pool, 'rec2');
            c = putFrom(c, 'pool', pool, (bindings) => {
              const rec = bindings.rec2 as Record<string, unknown>;
              const examples = (rec.examples as Array<Record<string, unknown>>) || [];
              return { ...rec, examples: examples.filter((e) => e.id !== exampleId) };
            });
            return complete(c, 'ok', { pool });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },
};

export const fewShotExampleHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetFewShotExample(): void {
  idCounter = 0;
  exampleIdCounter = 0;
}
