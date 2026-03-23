// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Rollout Concept Implementation
// Progressive delivery orchestration. Manages canary, blue-green, and
// linear rollout strategies with step-by-step traffic shifting.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'rollout';
const VALID_STRATEGIES = ['canary', 'blue-green', 'linear', 'immediate'];

const _handler: FunctionalConceptHandler = {
  begin(input: Record<string, unknown>) {
    if (!input.steps || (typeof input.steps === 'string' && (input.steps as string).trim() === '')) {
      return complete(createProgram(), 'invalidStrategy', { message: 'steps is required' }) as StorageProgram<Result>;
    }
    const plan = input.plan as string;
    const strategy = input.strategy as string;
    const steps = input.steps;

    if (!VALID_STRATEGIES.includes(strategy)) {
      let p = createProgram();
      return complete(p, 'invalidStrategy', {
        message: `Invalid strategy "${strategy}". Valid: ${VALID_STRATEGIES.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    const weightSteps = [10, 25, 50, 100];
    const rolloutId = `ro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, RELATION, rolloutId, {
      rollout: rolloutId,
      plan,
      strategy,
      steps: JSON.stringify(Array.isArray(steps) ? steps : [steps].filter(Boolean)),
      weightSteps: JSON.stringify(weightSteps),
      currentStep: 1,
      currentWeight: 0,
      status: 'active',
      startedAt: now,
      previousVersion: '',
      newVersion: '',
    });

    return complete(p, 'ok', { rollout: rolloutId }) as StorageProgram<Result>;
  },

  advance(input: Record<string, unknown>) {
    const rollout = input.rollout as string;

    let p = createProgram();
    p = get(p, RELATION, rollout, 'record');

    p = branch(p,
      (bindings) => !bindings.record,
      (b) => complete(b, 'paused', { rollout, reason: 'Rollout not found' }),
      (b) => {
        return branch(b,
          (bindings) => (bindings.record as Record<string, unknown>).status === 'paused',
          (b2) => complete(b2, 'paused', { rollout, reason: 'Rollout is paused' }),
          (b2) => {
            let b3 = mapBindings(b2, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              const weightSteps: number[] = JSON.parse(record.weightSteps as string || '[10,25,50,100]');
              const currentStep = (record.currentStep as number) + 1;
              const stepIndex = currentStep - 1;
              return { weightSteps, currentStep, stepIndex };
            }, 'stepInfo');

            return branch(b3,
              (bindings) => {
                const info = bindings.stepInfo as { stepIndex: number; weightSteps: number[] };
                return info.stepIndex >= info.weightSteps.length;
              },
              (b4) => {
                const b5 = putFrom(b4, RELATION, rollout, (bindings) => {
                  const record = bindings.record as Record<string, unknown>;
                  const info = bindings.stepInfo as { currentStep: number };
                  return {
                    ...record,
                    currentStep: info.currentStep,
                    currentWeight: 100,
                    status: 'complete',
                  };
                });
                return complete(b5, 'ok', { rollout });
              },
              (b4) => {
                b4 = putFrom(b4, RELATION, rollout, (bindings) => {
                  const record = bindings.record as Record<string, unknown>;
                  const info = bindings.stepInfo as { currentStep: number; stepIndex: number; weightSteps: number[] };
                  return {
                    ...record,
                    currentStep: info.currentStep,
                    currentWeight: info.weightSteps[info.stepIndex],
                  };
                });
                return completeFrom(b4, 'ok', (bindings) => {
                  const info = bindings.stepInfo as { currentStep: number; stepIndex: number; weightSteps: number[] };
                  return {
                    rollout,
                    newWeight: info.weightSteps[info.stepIndex],
                    step: info.currentStep,
                  };
                });
              },
            );
          },
        );
      },
    );

    return p as StorageProgram<Result>;
  },

  pause(input: Record<string, unknown>) {
    const rollout = input.rollout as string;
    const reason = input.reason as string;

    let p = createProgram();
    p = get(p, RELATION, rollout, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = putFrom(b, RELATION, rollout, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, status: 'paused', pauseReason: reason };
        });
        return complete(b2, 'ok', { rollout });
      },
      (b) => complete(b, 'error', { message: `Rollout "${rollout}" not found` }),
    );

    return p as StorageProgram<Result>;
  },

  resume(input: Record<string, unknown>) {
    const rollout = input.rollout as string;

    let p = createProgram();
    p = get(p, RELATION, rollout, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = putFrom(b, RELATION, rollout, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, status: 'active', pauseReason: '' };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { rollout, currentWeight: record.currentWeight as number };
        });
      },
      (b) => complete(b, 'error', { message: `Rollout "${rollout}" not found` }),
    );

    return p as StorageProgram<Result>;
  },

  abort(input: Record<string, unknown>) {
    const rollout = input.rollout as string;

    let p = createProgram();
    p = get(p, RELATION, rollout, 'record');

    p = branch(p,
      (bindings) => !bindings.record,
      // Non-existent rollout = already complete (never started or already finished)
      (b) => complete(b, 'alreadyComplete', { rollout }),
      (b) => {
        return branch(b,
          (bindings) => (bindings.record as Record<string, unknown>).status === 'complete',
          (b2) => complete(b2, 'alreadyComplete', { rollout }),
          (b2) => {
            const b3 = putFrom(b2, RELATION, rollout, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { ...record, status: 'aborted', currentWeight: 0 };
            });
            return complete(b3, 'ok', { rollout });
          },
        );
      },
    );

    return p as StorageProgram<Result>;
  },

  status(input: Record<string, unknown>) {
    const rollout = input.rollout as string;

    let p = createProgram();
    p = get(p, RELATION, rollout, 'record');

    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        const step = (record.currentStep as number) || 0;
        const weight = (record.currentWeight as number) || 0;
        const status = (record.status as string) || 'unknown';
        const startedAt = (record.startedAt as string) || new Date().toISOString();
        const elapsed = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
        return { rollout, step, weight, status, elapsed };
      }),
      (b) => complete(b, 'error', { message: `Rollout "${rollout}" not found` }),
    );

    return p as StorageProgram<Result>;
  },
};

export const rolloutHandler = autoInterpret(_handler);
