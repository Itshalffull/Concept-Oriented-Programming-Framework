// @clef-handler style=functional
// ============================================================
// CompensationPlan Concept Implementation
//
// Track compensating actions for saga-style rollback. As forward
// steps complete, their undo actions are registered. On failure,
// compensations execute in reverse order.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';
import { randomUUID } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

const _compensationPlanHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    const stepKey = input.step_key as string;
    const actionDescriptor = input.action_descriptor as string;

    if (!runRef || runRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'run_ref is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'plans', { run_ref: runRef }, 'existingPlans');

    p = mapBindings(p, (bindings) => {
      const plans = (bindings.existingPlans || []) as Array<Record<string, unknown>>;
      return plans.length > 0 ? plans[0] : null;
    }, 'existingPlan');

    const now = new Date().toISOString();
    const newCompensation = { step_key: stepKey, action_descriptor: actionDescriptor, registered_at: now };

    p = branch(p, 'existingPlan',
      // Plan exists — append compensation
      (b) => {
        let b2 = putFrom(b, 'plans', '_placeholder', (bindings) => {
          const existing = bindings.existingPlan as Record<string, unknown>;
          const compensations = (existing.compensations || []) as unknown[];
          return {
            ...existing,
            compensations: [...compensations, newCompensation],
          };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const existing = bindings.existingPlan as Record<string, unknown>;
          return { plan: existing.id as string };
        });
      },
      // No plan — create new
      (b) => {
        const planId = randomUUID();
        let b2 = put(b, 'plans', planId, {
          id: planId,
          run_ref: runRef,
          status: 'dormant',
          compensations: [newCompensation],
          current_index: -1,
        });
        return complete(b2, 'ok', { plan: planId });
      },
    );

    return p as StorageProgram<Result>;
  },

  trigger(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;

    if (!runRef || runRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'run_ref is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'plans', { run_ref: runRef }, 'existingPlans');

    p = mapBindings(p, (bindings) => {
      const plans = (bindings.existingPlans || []) as Array<Record<string, unknown>>;
      return plans.length > 0 ? plans[0] : null;
    }, 'plan');

    p = branch(p, 'plan',
      (b) => {
        // Check if already triggered/executing
        return mapBindings(b, (bindings) => {
          const plan = bindings.plan as Record<string, unknown>;
          return plan.status as string;
        }, '_status');
      },
      (b) => complete(b, 'ok', { run_ref: runRef }),
    );

    // After extracting status, branch on it
    p = branch(p,
      (bindings) => {
        const plan = bindings.plan as Record<string, unknown> | null;
        if (!plan) return false;
        const status = plan.status as string;
        return status === 'triggered' || status === 'executing';
      },
      (b) => complete(b, 'ok', { run_ref: runRef }),
      (b) => {
        // Plan exists and is dormant — trigger it
        return branch(b, 'plan',
          (b2) => {
            let b3 = putFrom(b2, 'plans', '_placeholder', (bindings) => {
              const plan = bindings.plan as Record<string, unknown>;
              const compensations = (plan.compensations || []) as unknown[];
              return {
                ...plan,
                status: 'triggered',
                current_index: compensations.length - 1,
              };
            });
            return completeFrom(b3, 'ok', (bindings) => {
              const plan = bindings.plan as Record<string, unknown>;
              return { plan: plan.id as string };
            });
          },
          (b2) => complete(b2, 'ok', { run_ref: runRef }),
        );
      },
    );

    return p as StorageProgram<Result>;
  },

  execute_next(input: Record<string, unknown>) {
    const planId = input.plan as string;

    let p = createProgram();
    p = get(p, 'plans', planId, 'existing');

    p = branch(p, 'existing',
      (b) => {
        return mapBindings(b, (bindings) => {
          const plan = bindings.existing as Record<string, unknown>;
          return plan.current_index as number;
        }, '_currentIndex');
      },
      (b) => complete(b, 'error', { message: 'Plan not found' }),
    );

    // Check if all compensations are done
    p = branch(p,
      (bindings) => {
        const existing = bindings.existing as Record<string, unknown> | null;
        if (!existing) return false;
        const idx = existing.current_index as number;
        return idx < 0;
      },
      // All done — mark completed
      (b) => {
        let b2 = putFrom(b, 'plans', planId, (bindings) => {
          const plan = bindings.existing as Record<string, unknown>;
          return { ...plan, status: 'completed', current_index: -1 };
        });
        return complete(b2, 'ok', { plan: planId });
      },
      // More to do — return next compensation
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const plan = bindings.existing as Record<string, unknown>;
          const compensations = (plan.compensations || []) as Array<Record<string, unknown>>;
          const idx = plan.current_index as number;
          return compensations[idx] || null;
        }, '_nextComp');

        b2 = putFrom(b2, 'plans', planId, (bindings) => {
          const plan = bindings.existing as Record<string, unknown>;
          const idx = plan.current_index as number;
          return { ...plan, status: 'executing', current_index: idx - 1 };
        });

        return completeFrom(b2, 'ok', (bindings) => {
          const comp = bindings._nextComp as Record<string, unknown>;
          return {
            plan: planId,
            step_key: comp.step_key as string,
            action_descriptor: comp.action_descriptor as string,
          };
        });
      },
    );

    return p as StorageProgram<Result>;
  },

  mark_compensation_failed(input: Record<string, unknown>) {
    const planId = input.plan as string;
    const stepKey = input.step_key as string;
    const error = input.error as string;

    let p = createProgram();
    p = get(p, 'plans', planId, 'existing');

    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'plans', planId, (bindings) => {
          const plan = bindings.existing as Record<string, unknown>;
          return {
            ...plan,
            status: 'failed',
            last_failure: { step_key: stepKey, error, failed_at: new Date().toISOString() },
          };
        });
        return complete(b2, 'ok', { plan: planId });
      },
      (b) => complete(b, 'error', { message: 'Plan not found' }),
    );

    return p as StorageProgram<Result>;
  },
};

export const compensationPlanHandler = autoInterpret(_compensationPlanHandler);
