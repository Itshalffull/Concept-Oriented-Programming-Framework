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
    const name = (input.name || input.agentType) as string;
    const allowedActions = input.allowedActions || input.boundaries;
    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name/agentType is required' }) as StorageProgram<Result>;
    }
    const id = `delegate-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'delegate', id, {
      id, name, agentType: name, principal: input.principal,
      autonomyLevel: input.autonomyLevel, allowedActions,
      systemPrompt: input.systemPrompt, boundaries: input.boundaries,
      registeredAt: new Date().toISOString(), active: true,
    });
    return complete(p, 'ok', { id, delegate: id }) as StorageProgram<Result>;
  },

  assumeRole(input: Record<string, unknown>) {
    const delegate = input.delegate as string;
    const role = (input.role || input.roleId) as string;
    if (!delegate || (typeof delegate === 'string' && delegate.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'delegate is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'delegate', delegate, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'delegate', delegate, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, currentRole: role };
        });
        return complete(thenP, 'ok', { delegate, role });
      },
      (elseP) => complete(elseP, 'not_found', { delegate }),
    ) as StorageProgram<Result>;
  },

  releaseRole(input: Record<string, unknown>) {
    const delegate = input.delegate as string;
    if (!delegate || (typeof delegate === 'string' && delegate.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'delegate is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'delegate', delegate, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'delegate', delegate, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, currentRole: null };
        });
        return complete(thenP, 'ok', { delegate });
      },
      (elseP) => complete(elseP, 'not_found', { delegate }),
    ) as StorageProgram<Result>;
  },

  proposeAction(input: Record<string, unknown>) {
    const delegate = input.delegate as string;
    const action = input.action as string;
    const rationale = input.rationale || input.justification;
    let p = createProgram();
    p = get(p, 'delegate', delegate, 'record');

    return branch(p, 'record',
      (thenP) => {
        return complete(thenP, 'ok', { delegate, action });
      },
      (elseP) => complete(elseP, 'not_found', { delegate }),
    ) as StorageProgram<Result>;
  },

  escalate(input: Record<string, unknown>) {
    const { delegate, action, reason } = input;
    if (!reason || (typeof reason === 'string' && (reason as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'reason is required' }) as StorageProgram<Result>;
    }
    return complete(createProgram(), 'ok', { delegate, action, reason }) as StorageProgram<Result>;
  },

  updateAutonomy(input: Record<string, unknown>) {
    const delegate = input.delegate as string;
    if (!delegate || (typeof delegate === 'string' && delegate.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'delegate is required' }) as StorageProgram<Result>;
    }
    const { autonomyLevel } = input;
    let p = createProgram();
    p = get(p, 'delegate', delegate, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'delegate', delegate, (bindings) => {
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
