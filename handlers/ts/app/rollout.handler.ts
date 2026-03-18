// @migrated dsl-constructs 2026-03-18
// Rollout Concept Implementation (Deploy Kit)
// Manage progressive delivery of concept deployments (canary, blue-green, rolling).
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

const _rolloutHandler: FunctionalConceptHandler = {
  begin(input: Record<string, unknown>) {
    const plan = input.plan as string;
    const strategy = input.strategy as string;
    const steps = input.steps as string;

    let p = createProgram();

    const validStrategies = ['canary', 'blue-green', 'rolling'];
    if (!validStrategies.includes(strategy)) {
      return complete(p, 'invalidStrategy', { message: `Unknown strategy: ${strategy}` }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let stepList: Array<{ weight: number; pauseSeconds: number }>;
    try {
      stepList = JSON.parse(steps);
    } catch {
      return complete(p, 'invalidStrategy', { message: 'Invalid step configuration JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    if (!Array.isArray(stepList) || stepList.length === 0) {
      return complete(p, 'invalidStrategy', { message: 'Steps must be a non-empty array' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const rolloutId = `ro-${Date.now()}`;
    const startedAt = new Date().toISOString();

    p = put(p, 'rollout', rolloutId, {
      rolloutId,
      strategy,
      steps: JSON.stringify(stepList),
      successCriteria: JSON.stringify({ maxErrorRate: 0.01, maxLatencyP99: 500 }),
      autoRollback: true,
      currentStep: 0,
      currentWeight: stepList[0].weight,
      startedAt,
      status: 'in_progress',
      oldVersion: '',
      newVersion: '',
      plan,
    });

    return complete(p, 'ok', { rollout: rolloutId }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  advance(input: Record<string, unknown>) {
    const rollout = input.rollout as string;

    let p = createProgram();
    p = spGet(p, 'rollout', rollout, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { rollout, newWeight: 100, step: 1 }),
      (b) => complete(b, 'paused', { rollout, reason: 'Rollout not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  pause(input: Record<string, unknown>) {
    const rollout = input.rollout as string;
    const reason = input.reason as string;

    let p = createProgram();
    p = spGet(p, 'rollout', rollout, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'rollout', rollout, { status: 'paused' });
        return complete(b2, 'ok', { rollout });
      },
      (b) => complete(b, 'ok', { rollout }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resume(input: Record<string, unknown>) {
    const rollout = input.rollout as string;

    let p = createProgram();
    p = spGet(p, 'rollout', rollout, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'rollout', rollout, { status: 'in_progress' });
        return complete(b2, 'ok', { rollout, currentWeight: 0 });
      },
      (b) => complete(b, 'ok', { rollout, currentWeight: 0 }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  abort(input: Record<string, unknown>) {
    const rollout = input.rollout as string;

    let p = createProgram();
    p = spGet(p, 'rollout', rollout, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'rollout', rollout, { status: 'aborted', currentWeight: 0 });
        return complete(b2, 'ok', { rollout });
      },
      (b) => complete(b, 'ok', { rollout }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  status(input: Record<string, unknown>) {
    const rollout = input.rollout as string;

    let p = createProgram();
    p = spGet(p, 'rollout', rollout, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { rollout, step: 0, weight: 0, status: 'unknown', elapsed: 0 }),
      (b) => complete(b, 'ok', { rollout, step: 0, weight: 0, status: 'unknown', elapsed: 0 }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const rolloutHandler = autoInterpret(_rolloutHandler);

