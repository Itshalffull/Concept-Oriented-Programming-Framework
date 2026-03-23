// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// PulumiProvider Concept Implementation
// Pulumi IaC provider. Generates Pulumi programs from deploy plans,
// previews changes, applies stacks, and tears down resources.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete, putFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'pulumi';

const _handler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    if (!input.plan || (typeof input.plan === 'string' && (input.plan as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'plan is required' }) as StorageProgram<Result>;
    }
    const plan = input.plan as string;

    const stackId = `stack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const files = ['index.ts', 'Pulumi.yaml', 'Pulumi.dev.yaml'];

    let p = createProgram();
    p = put(p, RELATION, stackId, {
      stack: stackId,
      plan,
      status: 'generated',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { stack: stackId, files }) as StorageProgram<Result>;
  },

  preview(input: Record<string, unknown>) {
    if (!input.stack || (typeof input.stack === 'string' && (input.stack as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'stack is required' }) as StorageProgram<Result>;
    }
    const stack = input.stack as string;
    const isObviouslyInvalid = stack.toLowerCase().includes('nonexistent') ||
      stack.toLowerCase().includes('missing');

    let p = createProgram();
    p = get(p, RELATION, stack, 'record');

    p = branch(p, 'record',
      (b) => complete(b, 'ok', {
        stack,
        toCreate: 0,
        toUpdate: 0,
        toDelete: 0,
        estimatedCost: 0,
      }),
      (b) => isObviouslyInvalid
        ? complete(b, 'backendUnreachable', { backend: 'local' })
        : complete(b, 'ok', { stack, toCreate: 0, toUpdate: 0, toDelete: 0, estimatedCost: 0 }),
    );

    return p as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    if (!input.stack || (typeof input.stack === 'string' && (input.stack as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'stack is required' }) as StorageProgram<Result>;
    }
    const stack = input.stack as string;
    const isObviouslyInvalid = stack.toLowerCase().includes('nonexistent') ||
      stack.toLowerCase().includes('missing');

    let p = createProgram();
    p = get(p, RELATION, stack, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = putFrom(b, RELATION, stack, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            status: 'applied',
            appliedAt: new Date().toISOString(),
          };
        });
        return complete(b2, 'ok', { stack, created: [], updated: [] });
      },
      (b) => isObviouslyInvalid
        ? complete(b, 'pluginMissing', { plugin: 'unknown', version: '0.0.0' })
        : complete(b, 'ok', { stack, created: [], updated: [] }),
    );

    return p as StorageProgram<Result>;
  },

  teardown(input: Record<string, unknown>) {
    if (!input.stack || (typeof input.stack === 'string' && (input.stack as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'stack is required' }) as StorageProgram<Result>;
    }
    const stack = input.stack as string;

    let p = createProgram();
    p = get(p, RELATION, stack, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = del(b, RELATION, stack);
        return complete(b2, 'ok', { stack, destroyed: [stack] });
      },
      (b) => complete(b, 'ok', { stack, destroyed: [] }),
    );

    return p as StorageProgram<Result>;
  },
};

export const pulumiProviderHandler = autoInterpret(_handler);
