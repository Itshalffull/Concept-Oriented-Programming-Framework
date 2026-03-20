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
    const id = `delegate-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'delegate', id, {
      id, name: input.name, principal: input.principal,
      autonomyLevel: input.autonomyLevel, allowedActions: input.allowedActions,
      registeredAt: new Date().toISOString(), active: true,
    });
    return complete(p, 'registered', { delegate: id }) as StorageProgram<Result>;
  },

  assumeRole(input: Record<string, unknown>) {
    const { delegate, role } = input;
    let p = createProgram();
    p = get(p, 'delegate', delegate as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'delegate', delegate as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, currentRole: role };
        });
        return complete(thenP, 'role_assumed', { delegate, role });
      },
      (elseP) => complete(elseP, 'not_found', { delegate }),
    ) as StorageProgram<Result>;
  },

  releaseRole(input: Record<string, unknown>) {
    const { delegate } = input;
    let p = createProgram();
    p = get(p, 'delegate', delegate as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'delegate', delegate as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, currentRole: null };
        });
        return complete(thenP, 'role_released', { delegate });
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
    const { delegate, action, reason } = input;
    return complete(createProgram(), 'escalated', { delegate, action, reason }) as StorageProgram<Result>;
  },

  updateAutonomy(input: Record<string, unknown>) {
    const { delegate, autonomyLevel } = input;
    let p = createProgram();
    p = get(p, 'delegate', delegate as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'delegate', delegate as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, autonomyLevel };
        });
        return complete(thenP, 'updated', { delegate });
      },
      (elseP) => complete(elseP, 'not_found', { delegate }),
    ) as StorageProgram<Result>;
  },
};

export const agenticDelegateHandler = autoInterpret(_agenticDelegateHandler);
