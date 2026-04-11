// ActionBinding handler — functional StorageProgram style
// Binds user interactions to concept action invocations with parameter
// resolution, confirmation, execution policy, and variant-driven UI states.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const VALID_POLICIES = ['optimistic', 'pessimistic', 'auto'];

const _handler: FunctionalConceptHandler = {

  register() {
    return { name: 'ActionBinding' };
  },

  bind(input: Record<string, unknown>) {
    const binding = input.binding as string;
    const target = input.target as string;
    const parameterMap = input.parameterMap as string;
    const precondition = (input.precondition as string) || null;
    const confirmWhen = (input.confirmWhen as string) || null;
    const executionPolicy = input.executionPolicy as string;
    const retryPolicy = (input.retryPolicy as string) || null;
    const reversalAction = (input.reversalAction as string) || null;
    const label = (input.label as string) || null;
    const icon = (input.icon as string) || null;
    const buttonVariant = (input.buttonVariant as string) || null;

    // Input validation
    if (!binding || binding.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'binding identifier is required' });
    }
    if (!target || target.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'target is required' });
    }
    if (!VALID_POLICIES.includes(executionPolicy)) {
      return complete(createProgram(), 'invalid', {
        message: `executionPolicy must be one of: ${VALID_POLICIES.join(', ')}`,
      });
    }

    // Validate parameterMap is valid JSON
    try {
      JSON.parse(parameterMap);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'parameterMap is not valid JSON' });
    }

    // Validate retryPolicy is valid JSON if provided
    if (retryPolicy) {
      try {
        JSON.parse(retryPolicy);
      } catch {
        return complete(createProgram(), 'invalid', { message: 'retryPolicy is not valid JSON' });
      }
    }

    // Check for duplicate
    let p = createProgram();
    p = get(p, 'bindings', binding, 'existing');
    return branch(p,
      (b) => !!b.existing,
      (b) => complete(b, 'duplicate', { message: `binding '${binding}' already exists` }),
      (b) => {
        let b2 = put(b, 'bindings', binding, {
          binding,
          target,
          parameterMap,
          precondition,
          confirmWhen,
          executionPolicy,
          retryPolicy,
          reversalAction,
          label,
          icon,
          buttonVariant,
          status: 'idle',
          lastTrace: null,
          pendingConfirmation: null,
        });
        return complete(b2, 'ok', { binding });
      },
    );
  },

  get(input: Record<string, unknown>) {
    const binding = input.binding as string;

    if (!binding) {
      return complete(createProgram(), 'notfound', { message: 'binding is required' });
    }

    let p = createProgram();
    p = get(p, 'bindings', binding, 'existing');
    p = mapBindings(p, (bindings) => bindings.existing != null, '_found');
    return branch(p,
      '_found',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          binding: rec.binding ?? binding,
          target: rec.target,
          parameterMap: rec.parameterMap,
          precondition: rec.precondition ?? null,
          confirmWhen: rec.confirmWhen ?? null,
          executionPolicy: rec.executionPolicy,
          retryPolicy: rec.retryPolicy ?? null,
          reversalAction: rec.reversalAction ?? null,
          label: rec.label ?? null,
          icon: rec.icon ?? null,
          buttonVariant: rec.buttonVariant ?? null,
          status: rec.status ?? 'idle',
        };
      }),
      (elseP) => complete(elseP, 'notfound', { message: `binding '${binding}' not found` }),
    );
  },

  invoke(input: Record<string, unknown>) {
    const binding = input.binding as string;
    const context = input.context as string;

    // Validate context is valid JSON
    try {
      JSON.parse(context);
    } catch {
      return complete(createProgram(), 'error', {
        variant: 'error',
        message: 'context is not valid JSON',
        trace: '',
      });
    }

    let p = createProgram();
    p = get(p, 'bindings', binding, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `binding '${binding}' not found` }),
      (b) => {
        // Check if confirmation is needed
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const cw = rec.confirmWhen as string | null;
          return cw != null && cw.trim() !== '';
        }, '_needsConfirm');

        return branch(b2,
          (bindings) => bindings._needsConfirm === true,
          (bp) => {
            // Needs confirmation — set pending state and return confirming
            let cp = putFrom(bp, 'bindings', binding, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return {
                ...rec,
                status: 'confirming',
                pendingConfirmation: context,
              };
            });
            return completeFrom(cp, 'confirming', (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return {
                binding,
                message: `Confirm action: ${rec.target as string}`,
              };
            });
          },
          (bp) => {
            // No confirmation needed — execute directly
            const traceId = `trace-${Date.now()}`;
            let ep = putFrom(bp, 'bindings', binding, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return {
                ...rec,
                status: 'executing',
                lastTrace: traceId,
              };
            });
            return complete(ep, 'ok', {
              result: '{}',
              trace: traceId,
            });
          },
        );
      },
    );
  },

  confirm(input: Record<string, unknown>) {
    const binding = input.binding as string;

    let p = createProgram();
    p = get(p, 'bindings', binding, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `binding '${binding}' not found` }),
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return rec.pendingConfirmation != null;
        }, '_hasPending');

        return branch(b2,
          (bindings) => bindings._hasPending !== true,
          (bp) => complete(bp, 'expired', { message: 'no confirmation pending' }),
          (bp) => {
            const traceId = `trace-${Date.now()}`;
            let cp = putFrom(bp, 'bindings', binding, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return {
                ...rec,
                status: 'executing',
                pendingConfirmation: null,
                lastTrace: traceId,
              };
            });
            return complete(cp, 'ok', {
              result: '{}',
              trace: traceId,
            });
          },
        );
      },
    );
  },

  cancel(input: Record<string, unknown>) {
    const binding = input.binding as string;

    let p = createProgram();
    p = get(p, 'bindings', binding, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `binding '${binding}' not found` }),
      (b) => {
        let cp = putFrom(b, 'bindings', binding, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            ...rec,
            status: 'idle',
            pendingConfirmation: null,
          };
        });
        return complete(cp, 'ok', {});
      },
    );
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'bindings', {}, 'all');
    return completeFrom(p, 'ok', (b) => {
      const items = (b.all || []) as Record<string, unknown>[];
      return { bindings: JSON.stringify(items) };
    });
  },

  remove(input: Record<string, unknown>) {
    const binding = input.binding as string;

    let p = createProgram();
    p = get(p, 'bindings', binding, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `binding '${binding}' not found` }),
      (b) => {
        let dp = del(b, 'bindings', binding);
        return complete(dp, 'ok', {});
      },
    );
  },
};

export const actionBindingHandler = autoInterpret(_handler);
