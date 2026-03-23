// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// CountingMethod Concept Handler
// Coordination concept routing vote aggregation to pluggable counting providers.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _countingMethodHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const id = `counting-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'counting', id, { id, name: input.name, providerRef: input.providerRef });
    return complete(p, 'ok', { method: id }) as StorageProgram<Result>;
  },

  aggregate(input: Record<string, unknown>) {
    if (!input.method || (typeof input.method === 'string' && (input.method as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'method is required' }) as StorageProgram<Result>;
    }
    const { method } = input;
    let p = createProgram();
    p = get(p, 'counting', method as string, 'record');

    p = branch(p, 'record',
      (b) => complete(b, 'ok', { outcome: 'stub_result', details: '{}' }),
      (b) => complete(b, 'not_found', { method }),
    );

    return p as StorageProgram<Result>;
  },

  deregister(input: Record<string, unknown>) {
    const { method } = input;
    let p = createProgram();
    p = del(p, 'counting', method as string);
    return complete(p, 'ok', { method }) as StorageProgram<Result>;
  },
};

export const countingMethodHandler = autoInterpret(_countingMethodHandler);
