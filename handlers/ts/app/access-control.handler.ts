// @migrated dsl-constructs 2026-03-18
// AccessControl Concept Implementation
// Evaluate three-valued access decisions (allowed/forbidden/neutral) with cacheable results.
// Policies are composable via logical OR and AND combinators.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, branch, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const accessControlHandler: FunctionalConceptHandler = {
  check(input: Record<string, unknown>) {
    const resource = input.resource as string;
    const action = input.action as string;
    const context = input.context as string;

    // Look up all applicable policies for this resource+action pair
    const policyKey = `${resource}:${action}`;

    let p = createProgram();
    p = spGet(p, 'policy', policyKey, 'policyRecord');
    p = branch(p, 'policyRecord',
      (b) => {
        const rec = {} as Record<string, unknown>; // resolved at runtime via bindings
        return complete(b, 'ok', {
          result: '',
          tags: '',
          maxAge: 0,
        });
      },
      (b) => {
        // No explicit policy registered: derive a default access decision.
        // Read actions are allowed by default; mutating actions are forbidden.
        const readActions = ['read', 'view', 'list', 'get'];
        const result = readActions.includes(action) ? 'allowed' : 'forbidden';
        const tags = `${resource}:${action}:${context}`;
        const maxAge = result === 'allowed' ? 300 : 60;
        return complete(b, 'ok', { result, tags, maxAge });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  orIf(input: Record<string, unknown>) {
    const left = input.left as string;
    const right = input.right as string;

    let p = createProgram();

    // Forbidden takes precedence over everything
    if (left === 'forbidden' || right === 'forbidden') {
      return complete(p, 'ok', { result: 'forbidden' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    // Allowed if either is allowed
    if (left === 'allowed' || right === 'allowed') {
      return complete(p, 'ok', { result: 'allowed' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    // Both must be neutral
    return complete(p, 'ok', { result: 'neutral' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  andIf(input: Record<string, unknown>) {
    const left = input.left as string;
    const right = input.right as string;

    let p = createProgram();

    // Forbidden wins over everything
    if (left === 'forbidden' || right === 'forbidden') {
      return complete(p, 'ok', { result: 'forbidden' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    // Allowed only if both are allowed
    if (left === 'allowed' && right === 'allowed') {
      return complete(p, 'ok', { result: 'allowed' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    // Otherwise neutral (at least one is neutral, neither is forbidden)
    return complete(p, 'ok', { result: 'neutral' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
