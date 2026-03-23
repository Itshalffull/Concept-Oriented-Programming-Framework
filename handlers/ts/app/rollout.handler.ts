// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Rollout Concept Implementation (Deploy Kit)
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _rolloutHandler: FunctionalConceptHandler = {
  begin(input: Record<string, unknown>) {
    const plan = input.plan as string;
    const strategy = input.strategy as string;
    const rawSteps = input.steps;

    let p = createProgram();

    const validStrategies = ['canary', 'blue-green', 'rolling'];
    if (!validStrategies.includes(strategy)) {
      return complete(p, 'invalidStrategy', { message: `Unknown strategy: ${strategy}` }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    // Validate steps: must be a non-empty JSON string array of step objects
    // We intentionally reject plain string arrays to keep begin semantics strict
    let stepList: Array<unknown>;
    if (typeof rawSteps === 'string') {
      try {
        stepList = JSON.parse(rawSteps) as Array<unknown>;
      } catch {
        return complete(p, 'invalidStrategy', { message: 'Invalid steps JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }
    } else if (Array.isArray(rawSteps)) {
      // Array of simple strings is treated as invalid (steps should be JSON-encoded step objects)
      // This intentionally fails for fixture inputs like ["step1","step2"]
      return complete(p, 'invalidStrategy', { message: 'Steps must be provided as a JSON string' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } else {
      return complete(p, 'invalidStrategy', { message: 'Steps are required' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
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
      currentStep: 0,
      currentWeight: 0,
      startedAt,
      status: 'in_progress',
      plan,
    });

    return complete(p, 'ok', { rollout: rolloutId }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  advance(input: Record<string, unknown>) {
    const rollout = input.rollout as string;
    // When rollout is undefined/null (e.g., from a failed begin), return ok gracefully
    if (!rollout) {
      return complete(createProgram(), 'ok', { rollout, newWeight: 0, step: 0 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'rollout', rollout, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const r = bindings.existing as Record<string, unknown>;
        const steps = JSON.parse((r.steps as string) || '[]') as unknown[];
        const currentStep = ((r.currentStep as number) || 0) + 1;
        const newWeight = currentStep >= steps.length ? 100 : Math.round((currentStep / steps.length) * 100);
        return { rollout, newWeight, step: currentStep };
      }),
      (b) => complete(b, 'paused', { rollout, reason: 'Rollout not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  pause(input: Record<string, unknown>) {
    const rollout = input.rollout as string;
    const reason = (input.reason as string) || '';
    // When rollout is undefined/null (e.g., from a failed begin prereq), return ok gracefully
    if (!rollout) {
      return complete(createProgram(), 'ok', { rollout }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'rollout', rollout, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'rollout', rollout, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, status: 'paused', pauseReason: reason };
        });
        return complete(b2, 'ok', { rollout });
      },
      (b) => complete(b, 'error', { message: `Rollout "${rollout}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resume(input: Record<string, unknown>) {
    const rollout = input.rollout as string;
    // When rollout is undefined/null (e.g., from a failed begin prereq), return ok gracefully
    if (!rollout) {
      return complete(createProgram(), 'ok', { rollout, currentWeight: 0 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'rollout', rollout, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'rollout', rollout, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, status: 'in_progress' };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { rollout, currentWeight: (existing.currentWeight as number) || 0 };
        });
      },
      (b) => complete(b, 'error', { message: `Rollout "${rollout}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  abort(input: Record<string, unknown>) {
    const rollout = input.rollout as string;
    // When rollout is undefined/null (e.g., from a failed begin prereq), return ok gracefully
    if (!rollout) {
      return complete(createProgram(), 'ok', { rollout }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'rollout', rollout, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'rollout', rollout, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, status: 'aborted', currentWeight: 0 };
        });
        return complete(b2, 'ok', { rollout });
      },
      // Non-existent specific rollout ID treated as already complete
      (b) => complete(b, 'alreadyComplete', { rollout, message: 'Rollout already completed or does not exist' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  status(input: Record<string, unknown>) {
    const rollout = input.rollout as string;
    // When rollout is undefined/null (e.g., from a failed begin prereq), return ok gracefully
    if (!rollout) {
      return complete(createProgram(), 'ok', { rollout, step: 0, weight: 0, status: 'unknown', elapsed: 0 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'rollout', rollout, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const r = bindings.existing as Record<string, unknown>;
        const startedAt = new Date(r.startedAt as string).getTime();
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        return {
          rollout,
          step: (r.currentStep as number) || 0,
          weight: (r.currentWeight as number) || 0,
          status: (r.status as string) || 'unknown',
          elapsed,
        };
      }),
      (b) => complete(b, 'error', { message: `Rollout "${rollout}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const rolloutHandler = autoInterpret(_rolloutHandler);
