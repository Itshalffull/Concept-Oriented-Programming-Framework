// @clef-handler style=functional
// EvaluationRun Concept Implementation
// Execute quality evaluations against step outputs and track metrics.
// Actual evaluation logic is delegated to evaluator providers.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `eval-${++idCounter}`;
}

const _evaluationRunHandler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'EvaluationRun' }) as StorageProgram<Result>;
  },

  run_eval(input: Record<string, unknown>) {
    const stepRef = input.step_ref as string;
    const evaluatorType = input.evaluator_type as string;
    const evalInput = input.input as string;
    const threshold = input.threshold as number;

    if (!stepRef || stepRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'step_ref is required' }) as StorageProgram<Result>;
    }

    const evalId = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'run', evalId, {
      eval: evalId,
      step_ref: stepRef,
      evaluator_type: evaluatorType,
      status: 'running',
      input: evalInput,
      score: null,
      threshold: threshold || null,
      metrics: [],
      feedback: null,
      evaluated_at: null,
      created_at: now,
    });
    return complete(p, 'ok', { eval: evalId, step_ref: stepRef, evaluator_type: evaluatorType }) as StorageProgram<Result>;
  },

  log_metric(input: Record<string, unknown>) {
    const evalId = input.eval as string;
    const metricName = input.metric_name as string;
    const metricValue = input.metric_value as number;

    if (!evalId) {
      return complete(createProgram(), 'error', { message: 'eval is required' }) as StorageProgram<Result>;
    }

    if (!metricName || metricName.trim() === '') {
      return complete(createProgram(), 'error', { message: 'metric_name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'run', evalId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (() => complete(createProgram(), 'error', { message: 'eval not found' }))(),
      (() => {
        let b = createProgram();
        b = get(b, 'run', evalId, 'existing');
        b = putFrom(b, 'run', evalId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const metrics = [...(existing.metrics as Array<{ name: string; value: number }>)];
          metrics.push({ name: metricName, value: metricValue });
          return { ...existing, metrics };
        });
        return complete(b, 'ok', { eval: evalId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  pass(input: Record<string, unknown>) {
    const evalId = input.eval as string;
    const score = input.score as number;
    const feedback = input.feedback as string;

    if (!evalId) {
      return complete(createProgram(), 'error', { message: 'eval is required' }) as StorageProgram<Result>;
    }

    if (!feedback || feedback.trim() === '') {
      return complete(createProgram(), 'error', { message: 'feedback is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'run', evalId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (() => complete(createProgram(), 'error', { message: 'eval not found' }))(),
      (() => {
        let b = createProgram();
        b = get(b, 'run', evalId, 'existing');
        const now = new Date().toISOString();
        b = putFrom(b, 'run', evalId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            ...existing,
            status: 'passed',
            score,
            feedback,
            evaluated_at: now,
          };
        });
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return existing.step_ref as string;
        }, '_stepRef');
        return completeFrom(b, 'ok', (bindings) => ({
          eval: evalId,
          step_ref: bindings._stepRef as string,
        }));
      })(),
    ) as StorageProgram<Result>;
  },

  fail(input: Record<string, unknown>) {
    const evalId = input.eval as string;
    const score = input.score as number;
    const feedback = input.feedback as string;

    if (!evalId) {
      return complete(createProgram(), 'error', { message: 'eval is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'run', evalId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (() => complete(createProgram(), 'error', { message: 'eval not found' }))(),
      (() => {
        let b = createProgram();
        b = get(b, 'run', evalId, 'existing');
        const now = new Date().toISOString();
        b = putFrom(b, 'run', evalId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            ...existing,
            status: 'failed',
            score,
            feedback,
            evaluated_at: now,
          };
        });
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return existing.step_ref as string;
        }, '_stepRef');
        return completeFrom(b, 'ok', (bindings) => ({
          eval: evalId,
          step_ref: bindings._stepRef as string,
          feedback,
        }));
      })(),
    ) as StorageProgram<Result>;
  },

  get_result(input: Record<string, unknown>) {
    const evalId = input.eval as string;

    if (!evalId) {
      return complete(createProgram(), 'not_found', { eval: evalId }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'run', evalId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (() => complete(createProgram(), 'not_found', { eval: evalId }))(),
      (() => {
        let b = createProgram();
        b = get(b, 'run', evalId, 'existing');
        return completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            eval: evalId,
            status: existing.status as string,
            score: existing.score as number,
            feedback: (existing.feedback as string) || '',
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const evaluationRunHandler = autoInterpret(_evaluationRunHandler);
