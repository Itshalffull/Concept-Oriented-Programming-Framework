// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// AgenticDelegate Concept Handler
// Register and constrain AI agents participating in governance.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _agenticDelegateHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!input.allowedActions || (typeof input.allowedActions === 'string' && (input.allowedActions as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'allowedActions is required' }) as StorageProgram<Result>;
    }
    const id = `delegate-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'delegate', id, {
      id, name: input.name, principal: input.principal,
      autonomyLevel: input.autonomyLevel, allowedActions: input.allowedActions,
      registeredAt: new Date().toISOString(), active: true,
    });
    return complete(p, 'ok', { delegate: id }) as StorageProgram<Result>;
  },

  assumeRole(input: Record<string, unknown>) {
    if (!input.delegate || (typeof input.delegate === 'string' && (input.delegate as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'delegate is required' }) as StorageProgram<Result>;
    }
    if (!input.role || (typeof input.role === 'string' && (input.role as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'role is required' }) as StorageProgram<Result>;
    }
    const { delegate, role } = input;
    let p = createProgram();
    p = get(p, 'delegate', delegate as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'delegate', delegate as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, currentRole: role };
        });
        return complete(thenP, 'ok', { delegate, role });
      },
      (elseP) => complete(elseP, 'not_found', { delegate }),
    ) as StorageProgram<Result>;
  },

  releaseRole(input: Record<string, unknown>) {
    if (!input.delegate || (typeof input.delegate === 'string' && (input.delegate as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'delegate is required' }) as StorageProgram<Result>;
    }
    const { delegate } = input;
    let p = createProgram();
    p = get(p, 'delegate', delegate as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'delegate', delegate as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, currentRole: null };
        });
        return complete(thenP, 'ok', { delegate });
      },
      (elseP) => complete(elseP, 'not_found', { delegate }),
    ) as StorageProgram<Result>;
  },

  proposeAction(input: Record<string, unknown>) {
    const { delegate, action, rationale } = input;
    let p = createProgram();
    p = get(p, 'delegate', delegate as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'proposed', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const allowed = (record.allowedActions as string[]).includes(action as string);
          if (!allowed) return { variant: 'action_denied', delegate, action };
          return { variant: 'proposed', delegate, action };
        });
      },
      (elseP) => complete(elseP, 'not_found', { delegate }),
    ) as StorageProgram<Result>;
  },

  escalate(input: Record<string, unknown>) {
    if (!input.reason || (typeof input.reason === 'string' && (input.reason as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'reason is required' }) as StorageProgram<Result>;
    }
    const { delegate, action, reason } = input;
    return complete(createProgram(), 'ok', { delegate, action, reason }) as StorageProgram<Result>;
  },

  updateAutonomy(input: Record<string, unknown>) {
    if (!input.delegate || (typeof input.delegate === 'string' && (input.delegate as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'delegate is required' }) as StorageProgram<Result>;
    }
    const { delegate, autonomyLevel } = input;
    let p = createProgram();
    p = get(p, 'delegate', delegate as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'delegate', delegate as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, autonomyLevel };
        });
        return complete(thenP, 'ok', { delegate });
      },
      (elseP) => complete(elseP, 'not_found', { delegate }),
    ) as StorageProgram<Result>;
  },
};

export const agenticDelegateHandler = autoInterpret(_agenticDelegateHandler);
