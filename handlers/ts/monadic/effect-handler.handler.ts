// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, putLens, getLens, find, del, complete, completeFrom, branch, relation, at,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

// Lenses for storing effect handler registrations — dogfooding the lens DSL
const handlersRel = relation('handlers');

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
    p = getLens(p, at(handlersRel, handlerId), 'existing');

    return branch(p, 'existing',
      (thenP) => complete(thenP, 'duplicate', { handler: handlerId }),
      (elseP) => {
        elseP = putLens(elseP, at(handlersRel, handlerId), {
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
    p = getLens(p, at(handlersRel, handlerId), 'handler');

    return branch(p, 'handler',
      (thenP) => complete(thenP, 'ok', { handler: handlerId }),
      (elseP) => complete(elseP, 'error', { message: `No handler registered for ${protocol}:${operation}` }),
    ) as StorageProgram<Result>;
  },

  listByProtocol(input: Record<string, unknown>) {
    if (!input.protocol || (typeof input.protocol === 'string' && (input.protocol as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'protocol is required' }) as StorageProgram<Result>;
    }
    const protocol = input.protocol as string;

    let p = createProgram();
    p = find(p, 'handlers', { protocol }, 'handlers');
    p = complete(p, 'ok', { handlers: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
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
    p = getLens(p, at(handlersRel, handlerId), 'existing');
    p = del(p, 'handlers', handlerId);
    p = complete(p, 'ok', { handler: handlerId });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
