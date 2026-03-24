// @clef-handler style=functional
// ============================================================
// EvaluationDataset Concept Implementation
//
// Golden datasets for continuous behavioral testing of LLM systems.
// Curated collections of reference inputs and expected outcomes.
// Detects prompt drift (silent degradation when models update).
// Supports LLM-as-judge evaluation, semantic scoring, and
// statistical comparison between versions.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let _datasetCounter = 0;
function generateDatasetId(): string {
  return `ds-${Date.now()}-${++_datasetCounter}`;
}

let _exampleCounter = 0;
function generateExampleId(): string {
  return `ex-${Date.now()}-${++_exampleCounter}`;
}

let _runCounter = 0;
function generateRunId(): string {
  return `run-${Date.now()}-${++_runCounter}`;
}

/**
 * Stub evaluation scoring. Production would use actual LLM-as-judge
 * or semantic similarity via syncs.
 */
function stubScore(expected: string, actual: string): number {
  if (expected === actual) return 1.0;
  const eWords = new Set(expected.toLowerCase().split(/\s+/));
  const aWords = new Set(actual.toLowerCase().split(/\s+/));
  let overlap = 0;
  for (const w of aWords) {
    if (eWords.has(w)) overlap++;
  }
  return overlap / Math.max(eWords.size, 1);
}

const _evaluationDatasetHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const examples = input.examples as {
      input: string;
      expected: string;
      rubric: string | null;
      tags: string[];
    }[];

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!examples || examples.length === 0) {
      return complete(createProgram(), 'invalid', { message: 'Empty examples' }) as StorageProgram<Result>;
    }

    const id = generateDatasetId();
    const taggedExamples = examples.map(ex => ({
      id: generateExampleId(),
      input: ex.input,
      expected: ex.expected,
      rubric: ex.rubric ?? null,
      tags: ex.tags || [],
    }));

    let p = createProgram();
    p = put(p, 'datasets', id, {
      id,
      name,
      examples: taggedExamples,
      version: 1,
      evaluation_history: [],
      drift_baseline: null,
    });

    return complete(p, 'ok', { dataset: id }) as StorageProgram<Result>;
  },

  addExample(input: Record<string, unknown>) {
    const datasetId = input.dataset as string;
    const exInput = input.input as string;
    const expected = input.expected as string;
    const rubric = (input.rubric as string | null) ?? null;
    const tags = (input.tags as string[]) || [];

    let p = createProgram();
    p = get(p, 'datasets', datasetId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Dataset not found' }),
      (() => {
        const exampleId = generateExampleId();
        let b = createProgram();
        b = get(b, 'datasets', datasetId, 'existing');
        b = putFrom(b, 'datasets', datasetId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const examples = [...(existing.examples as Record<string, unknown>[])];
          examples.push({
            id: exampleId,
            input: exInput,
            expected,
            rubric,
            tags,
          });
          return {
            ...existing,
            examples,
            version: (existing.version as number) + 1,
          };
        });
        return complete(b, 'ok', { example_id: exampleId, dataset: datasetId });
      })(),
    ) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const datasetId = input.dataset as string;
    const program = input.program as string;
    const metrics = input.metrics as string[];

    let p = createProgram();
    p = get(p, 'datasets', datasetId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Evaluation failed: dataset not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'datasets', datasetId, 'existing');
        b = mapBindings(b, (bindings) => {
          const ds = bindings.existing as Record<string, unknown>;
          const examples = ds.examples as { id: string; input: string; expected: string }[];

          // Stub: score each example
          const perExample = examples.map(ex => ({
            example_id: ex.id,
            score: stubScore(ex.expected, `[${program} output for: ${ex.input}]`),
          }));

          const overallScore = perExample.reduce((sum, e) => sum + e.score, 0) / Math.max(perExample.length, 1);

          // Score per metric (stub: same score for all metrics)
          const perMetric = metrics.map(m => ({
            metric: m,
            score: overallScore + (Math.random() * 0.1 - 0.05), // slight variation
          }));

          const runId = generateRunId();

          return {
            overall: overallScore,
            perExample,
            perMetric,
            runId,
          };
        }, 'evalResult');

        // Record in evaluation history
        b = putFrom(b, 'datasets', datasetId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const result = bindings.evalResult as Record<string, unknown>;
          const history = [...(existing.evaluation_history as Record<string, unknown>[])];
          history.push({
            run_id: result.runId,
            timestamp: new Date().toISOString(),
            program,
            scores: result.perMetric,
          });
          return { ...existing, evaluation_history: history };
        });

        return completeFrom(b, 'ok', (bindings) => {
          const result = bindings.evalResult as Record<string, unknown>;
          return {
            overall: result.overall as number,
            per_example: result.perExample as unknown[],
            per_metric: result.perMetric as unknown[],
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  detectDrift(input: Record<string, unknown>) {
    const datasetId = input.dataset as string;
    const currentProgram = input.current_program as string;

    let p = createProgram();
    p = get(p, 'datasets', datasetId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'no_baseline', { message: 'Dataset not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'datasets', datasetId, 'existing');
        b = mapBindings(b, (bindings) => {
          const ds = bindings.existing as Record<string, unknown>;
          return ds.drift_baseline;
        }, 'baseline');

        return branch(b,
          (bindings) => !bindings.baseline,
          complete(createProgram(), 'no_baseline', { message: 'No drift baseline set. Call setBaseline first.' }),
          (() => {
            let d = createProgram();
            d = get(d, 'datasets', datasetId, 'existing');
            d = mapBindings(d, (bindings) => {
              const ds = bindings.existing as Record<string, unknown>;
              const baseline = ds.drift_baseline as { program: string; scores: { metric: string; score: number }[] };
              const examples = ds.examples as { id: string; input: string; expected: string }[];

              // Stub: compute current scores and compare to baseline
              const baselineAvg = baseline.scores.reduce((s, m) => s + m.score, 0) / Math.max(baseline.scores.length, 1);
              const currentScores = examples.map(ex => ({
                id: ex.id,
                baseline_score: baselineAvg,
                current_score: stubScore(ex.expected, `[${currentProgram} output for: ${ex.input}]`),
              }));

              const currentAvg = currentScores.reduce((s, e) => s + e.current_score, 0) / Math.max(currentScores.length, 1);
              const driftMagnitude = Math.abs(baselineAvg - currentAvg);
              const drifted = driftMagnitude > 0.05;

              const degraded = currentScores
                .filter(e => e.current_score < e.baseline_score - 0.01)
                .sort((a, b) => (b.baseline_score - b.current_score) - (a.baseline_score - a.current_score));

              return { drifted, driftMagnitude, degraded };
            }, 'driftResult');

            return completeFrom(d, 'ok', (bindings) => {
              const result = bindings.driftResult as Record<string, unknown>;
              return {
                drifted: result.drifted as boolean,
                drift_magnitude: result.driftMagnitude as number,
                degraded_examples: result.degraded as unknown[],
              };
            });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  setBaseline(input: Record<string, unknown>) {
    const datasetId = input.dataset as string;
    const program = input.program as string;

    let p = createProgram();
    p = get(p, 'datasets', datasetId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Dataset not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'datasets', datasetId, 'existing');
        b = putFrom(b, 'datasets', datasetId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const history = existing.evaluation_history as { program: string; scores: unknown[] }[];

          // Find latest evaluation for this program, or create stub scores
          const latestEval = history.filter(h => h.program === program).pop();
          const scores = latestEval?.scores ?? [{ metric: 'accuracy', score: 0.8 }];

          return {
            ...existing,
            drift_baseline: { program, scores },
          };
        });

        return complete(b, 'ok', { dataset: datasetId });
      })(),
    ) as StorageProgram<Result>;
  },

  compare(input: Record<string, unknown>) {
    const datasetId = input.dataset as string;
    const programA = input.program_a as string;
    const programB = input.program_b as string;

    let p = createProgram();
    p = get(p, 'datasets', datasetId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Comparison failed: dataset not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'datasets', datasetId, 'existing');
        b = mapBindings(b, (bindings) => {
          const ds = bindings.existing as Record<string, unknown>;
          const examples = ds.examples as { id: string; input: string; expected: string }[];

          const perExample = examples.map(ex => {
            const scoreA = stubScore(ex.expected, `[${programA} output for: ${ex.input}]`);
            const scoreB = stubScore(ex.expected, `[${programB} output for: ${ex.input}]`);
            return { id: ex.id, score_a: scoreA, score_b: scoreB };
          });

          const avgA = perExample.reduce((s, e) => s + e.score_a, 0) / Math.max(perExample.length, 1);
          const avgB = perExample.reduce((s, e) => s + e.score_b, 0) / Math.max(perExample.length, 1);
          const winner = avgA >= avgB ? programA : programB;

          // Stub confidence based on score difference
          const diff = Math.abs(avgA - avgB);
          const confidence = Math.min(0.99, diff * 10);

          return { winner, score_a: avgA, score_b: avgB, confidence, perExample };
        }, 'compareResult');

        return completeFrom(b, 'ok', (bindings) => {
          const result = bindings.compareResult as Record<string, unknown>;
          return {
            winner: result.winner as string,
            score_a: result.score_a as number,
            score_b: result.score_b as number,
            confidence: result.confidence as number,
            per_example: result.perExample as unknown[],
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  curate(input: Record<string, unknown>) {
    const datasetId = input.dataset as string;
    const filterTags = input.filter_tags as string[];

    let p = createProgram();
    p = get(p, 'datasets', datasetId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'empty', { message: 'No examples match tags' }),
      (() => {
        let b = createProgram();
        b = get(b, 'datasets', datasetId, 'existing');
        b = mapBindings(b, (bindings) => {
          const ds = bindings.existing as Record<string, unknown>;
          const examples = ds.examples as { id: string; input: string; expected: string; tags: string[] }[];

          const subset = examples.filter(ex =>
            filterTags.some(tag => ex.tags.includes(tag))
          ).map(ex => ({ id: ex.id, input: ex.input, expected: ex.expected }));

          return subset;
        }, 'subset');

        return branch(b,
          (bindings) => (bindings.subset as unknown[]).length === 0,
          complete(createProgram(), 'empty', { message: 'No examples match tags' }),
          completeFrom(createProgram(), 'ok', (bindings) => ({
            subset: bindings.subset as unknown[],
            count: (bindings.subset as unknown[]).length,
          })),
        );
      })(),
    ) as StorageProgram<Result>;
  },
};

export const evaluationDatasetHandler = autoInterpret(_evaluationDatasetHandler);
