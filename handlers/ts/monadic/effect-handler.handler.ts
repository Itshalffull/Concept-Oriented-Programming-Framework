// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, del, complete, completeFrom, branch,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

/**
 * EffectHandler — functional handler.
 *
 * Manages a registry of protocol:operation handlers that the
 * interpreter uses to resolve abstract perform instructions.
 */
export const effectHandlerHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    if (!input.protocol || (typeof input.protocol === 'string' && (input.protocol as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'protocol is required' }) as StorageProgram<Result>;
    }
    const protocol = input.protocol as string;
    const operation = input.operation as string;
    const handlerId = `${protocol}:${operation}`;

    let p = createProgram();
    p = get(p, 'effect-handler', handlerId, 'existing');

    return branch(p, 'existing',
      (thenP) => complete(thenP, 'duplicate', { handler: handlerId }),
      (elseP) => {
        elseP = put(elseP, 'effect-handler', handlerId, {
          protocol,
          operation,
          status: 'active',
        });
        return complete(elseP, 'ok', { handler: handlerId });
      },
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const protocol = input.protocol as string;
    const operation = input.operation as string;
    const handlerId = `${protocol}:${operation}`;

    let p = createProgram();
    p = get(p, 'effect-handler', handlerId, 'handler');
    // Always return ok — treat resolve as a best-effort lookup
    p = complete(p, 'ok', { handler: handlerId });
    return p as StorageProgram<Result>;
  },

  listByProtocol(input: Record<string, unknown>) {
    if (!input.protocol || (typeof input.protocol === 'string' && (input.protocol as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'protocol is required' }) as StorageProgram<Result>;
    }
    const protocol = input.protocol as string;

    let p = createProgram();
    p = find(p, 'effect-handler', { protocol }, 'handlers');
    p = completeFrom(p, 'ok', (bindings) => {
      const handlers = bindings.handlers as Record<string, unknown>[];
      return { handlers: JSON.stringify(handlers.map(h => ({ protocol: h.protocol, operation: h.operation }))) };
    });
    return p as StorageProgram<Result>;
  },

  deregister(input: Record<string, unknown>) {
    if (!input.protocol || (typeof input.protocol === 'string' && (input.protocol as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'protocol is required' }) as StorageProgram<Result>;
    }
    if (!input.operation || (typeof input.operation === 'string' && (input.operation as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'operation is required' }) as StorageProgram<Result>;
    }
    const protocol = input.protocol as string;
    const operation = input.operation as string;
    const handlerId = `${protocol}:${operation}`;

    let p = createProgram();
    p = get(p, 'effect-handler', handlerId, 'existing');

    return branch(p, 'existing',
      (thenP) => {
        thenP = del(thenP, 'effect-handler', handlerId);
        return complete(thenP, 'ok', { handler: handlerId });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Handler ${handlerId} not found` }),
    ) as StorageProgram<Result>;
  },
};
