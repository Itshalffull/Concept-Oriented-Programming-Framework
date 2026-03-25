// @clef-handler style=functional
// PromptOptimizer Concept Implementation
// Automatically improves prompts using LLM-driven optimization (DSPy paradigm).
// Supports BootstrapFewShot, MIPROv2, COPRO, OPRO, and evolutionary strategies.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;

function nextId(): string {
  return `prompt-optimizer-${++idCounter}`;
}

const VALID_STRATEGIES = new Set([
  'bootstrap_few_shot', 'mipro_v2', 'copro', 'opro', 'evolutionary',
]);

/** Compute a heuristic similarity score between a program string and expected outputs. */
function evaluateProgram(
  program: string,
  dataset: Array<{ input: string; expected: string }>,
): number {
  if (dataset.length === 0) return 0;
  // Heuristic: score based on keyword overlap between program and expected values
  let totalScore = 0;
  for (const example of dataset) {
    const programWords = new Set(program.toLowerCase().split(/\s+/));
    const expectedWords = example.expected.toLowerCase().split(/\s+/);
    const matches = expectedWords.filter((w) => programWords.has(w)).length;
    totalScore += matches / Math.max(expectedWords.length, 1);
  }
  return totalScore / dataset.length;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'PromptOptimizer' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const target = input.target as string;
    const metric = input.metric as string;
    const trainingSet = input.training_set as Array<{ input: string; expected: string }>;
    const strategy = input.strategy as string;
    const maxLlmCalls = input.max_llm_calls as number;

    if (!target || target.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'target is required' }) as StorageProgram<Result>;
    }
    if (!strategy || strategy.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'strategy is required' }) as StorageProgram<Result>;
    }
    if (!VALID_STRATEGIES.has(strategy)) {
      return complete(createProgram(), 'invalid', { message: `Unknown strategy: ${strategy}` }) as StorageProgram<Result>;
    }
    if (!trainingSet || !Array.isArray(trainingSet) || trainingSet.length === 0) {
      return complete(createProgram(), 'invalid', { message: 'training_set must be non-empty' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'optimizer', id, {
      id,
      target_program: target,
      metric: metric || 'accuracy',
      training_set: trainingSet,
      strategy,
      history: [],
      best_candidate: null,
      budget: { max_llm_calls: maxLlmCalls ?? 100, used_calls: 0 },
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { optimizer: id }) as StorageProgram<Result>;
  },

  optimize(input: Record<string, unknown>) {
    const optimizer = input.optimizer as string;

    if (!optimizer || optimizer.trim() === '') {
      return complete(createProgram(), 'error', { message: 'optimizer is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'optimizer', optimizer, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Optimizer not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'optimizer', optimizer, 'rec');
        b = mapBindings(b, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const budget = rec.budget as { max_llm_calls: number; used_calls: number };
          return budget.used_calls >= budget.max_llm_calls;
        }, '_budgetExceeded');

        return branch(b,
          (bindings) => bindings._budgetExceeded as boolean,
          (() => {
            let c = createProgram();
            c = get(c, 'optimizer', optimizer, 'recBudget');
            return completeFrom(c, 'budget_exceeded', (bindings) => {
              const rec = bindings.recBudget as Record<string, unknown>;
              const best = rec.best_candidate as { prompt: string; score: number } | null;
              return {
                best_so_far: best?.prompt ?? rec.target_program as string,
                score: best?.score ?? 0,
              };
            });
          })(),
          (() => {
            let c = createProgram();
            c = get(c, 'optimizer', optimizer, 'recOpt');
            c = putFrom(c, 'optimizer', optimizer, (bindings) => {
              const rec = bindings.recOpt as Record<string, unknown>;
              const strategy = rec.strategy as string;
              const trainingSet = rec.training_set as Array<{ input: string; expected: string }>;
              const target = rec.target_program as string;
              const budget = rec.budget as { max_llm_calls: number; used_calls: number };
              const history = (rec.history as Array<Record<string, unknown>>) || [];

              // Simulate optimization iterations
              const maxIterations = Math.min(5, budget.max_llm_calls - budget.used_calls);
              const candidates: Array<{ candidate: string; score: number; iteration: number }> = [];
              let bestPrompt = target;
              let bestScore = evaluateProgram(target, trainingSet);

              for (let i = 0; i < maxIterations; i++) {
                // Generate candidate by applying simple mutations (simulation)
                let candidate = target;
                if (strategy === 'bootstrap_few_shot') {
                  candidate = `${target}\nExamples:\n${trainingSet.slice(0, 2).map((ex) => `Input: ${ex.input}\nOutput: ${ex.expected}`).join('\n')}`;
                } else if (strategy === 'mipro_v2') {
                  candidate = `[Optimized with MIPROv2 iteration ${i + 1}]\n${target}`;
                } else if (strategy === 'copro') {
                  candidate = `[COPRO: ${target}. Refined for: ${trainingSet[0]?.input ?? 'task'}]`;
                } else if (strategy === 'opro') {
                  candidate = `[OPRO iteration ${i + 1}] ${target} [Score target: high accuracy]`;
                } else if (strategy === 'evolutionary') {
                  candidate = i % 2 === 0
                    ? `${target}\n[Mutation: added specificity]`
                    : `[Crossover] ${target.slice(0, Math.ceil(target.length / 2))} [optimized tail]`;
                }

                const score = evaluateProgram(candidate, trainingSet) + Math.random() * 0.1;
                candidates.push({ candidate, score, iteration: i + 1 });
                if (score > bestScore) {
                  bestScore = score;
                  bestPrompt = candidate;
                }
              }

              return {
                ...rec,
                history: [...history, ...candidates],
                best_candidate: { prompt: bestPrompt, score: bestScore },
                budget: {
                  max_llm_calls: budget.max_llm_calls,
                  used_calls: budget.used_calls + maxIterations,
                },
              };
            });

            c = get(c, 'optimizer', optimizer, 'recOptUpdated');
            return completeFrom(c, 'ok', (bindings) => {
              const rec = bindings.recOptUpdated as Record<string, unknown>;
              const history = (rec.history as Array<Record<string, unknown>>) || [];
              const best = rec.best_candidate as { prompt: string; score: number } | null;
              return {
                best_prompt: best?.prompt ?? rec.target_program as string,
                score: best?.score ?? 0,
                iterations: history.length,
              };
            });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const optimizer = input.optimizer as string;
    const program = input.program as string;
    const dataset = input.dataset as Array<{ input: string; expected: string }>;

    if (!optimizer || optimizer.trim() === '') {
      return complete(createProgram(), 'error', { message: 'optimizer is required' }) as StorageProgram<Result>;
    }
    if (!dataset || !Array.isArray(dataset) || dataset.length === 0) {
      return complete(createProgram(), 'error', { message: 'dataset must be non-empty' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'optimizer', optimizer, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Optimizer not found' }),
      (() => {
        const perExample = dataset.map((ex) => {
          const score = evaluateProgram(program, [ex]);
          return { input: ex.input, score };
        });
        const avgScore = perExample.reduce((sum, e) => sum + e.score, 0) / perExample.length;
        return complete(createProgram(), 'ok', { score: avgScore, per_example: perExample });
      })(),
    ) as StorageProgram<Result>;
  },

  compare(input: Record<string, unknown>) {
    const optimizer = input.optimizer as string;
    const programs = input.programs as string[];
    const dataset = input.dataset as Array<{ input: string; expected: string }>;

    if (!optimizer || optimizer.trim() === '') {
      return complete(createProgram(), 'error', { message: 'optimizer is required' }) as StorageProgram<Result>;
    }
    if (!programs || !Array.isArray(programs) || programs.length === 0) {
      return complete(createProgram(), 'error', { message: 'programs must be non-empty' }) as StorageProgram<Result>;
    }
    if (!dataset || !Array.isArray(dataset) || dataset.length === 0) {
      return complete(createProgram(), 'error', { message: 'dataset must be non-empty' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'optimizer', optimizer, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Optimizer not found' }),
      (() => {
        const ranked = programs
          .map((prog) => ({ program: prog, score: evaluateProgram(prog, dataset) }))
          .sort((a, b) => b.score - a.score);
        return complete(createProgram(), 'ok', { ranked });
      })(),
    ) as StorageProgram<Result>;
  },

  rollback(input: Record<string, unknown>) {
    const optimizer = input.optimizer as string;
    const iteration = input.iteration as number;

    if (!optimizer || optimizer.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'optimizer is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'optimizer', optimizer, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Optimizer not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'optimizer', optimizer, 'rec');
        b = mapBindings(b, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const history = (rec.history as Array<{ candidate: string; score: number; iteration: number }>) || [];
          return history.find((h) => h.iteration === iteration) ?? null;
        }, '_candidate');

        return branch(b,
          (bindings) => !bindings._candidate,
          complete(createProgram(), 'notfound', { message: 'Iteration not found' }),
          (() => {
            let c = createProgram();
            c = get(c, 'optimizer', optimizer, 'rec2');
            c = putFrom(c, 'optimizer', optimizer, (bindings) => {
              const rec = bindings.rec2 as Record<string, unknown>;
              const candidate = bindings._candidate as { candidate: string; score: number; iteration: number };
              return {
                ...rec,
                best_candidate: { prompt: candidate.candidate, score: candidate.score },
              };
            });
            return completeFrom(c, 'ok', (bindings) => {
              const candidate = bindings._candidate as { candidate: string; score: number };
              return { prompt: candidate.candidate, score: candidate.score };
            });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },
};

export const promptOptimizerHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetPromptOptimizer(): void {
  idCounter = 0;
}
