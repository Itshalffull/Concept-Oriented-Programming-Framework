// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Delegation Concept Handler
// Transitive decision power transfer with cycle detection.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _delegationHandler: FunctionalConceptHandler = {
  delegate(input: Record<string, unknown>) {
    const { from, to, scope, expiresAt } = input;
    let p = createProgram();
    p = get(p, 'delegation', `${to}:${from}`, 'reverse');

    p = branch(p, 'reverse',
      (b) => complete(b, 'cycle_detected', { from, to }),
      (b) => {
        const id = `deleg-${Date.now()}`;
        let b2 = put(b, 'delegation', `${from}:${to}`, {
          id, from, to, scope, expiresAt: expiresAt ?? null,
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'delegated', { edge: id });
      },
    );

    return p as StorageProgram<Result>;
  },

  undelegate(input: Record<string, unknown>) {
    const { from, to } = input;
    let p = createProgram();
    p = get(p, 'delegation', `${from}:${to}`, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = del(b, 'delegation', `${from}:${to}`);
        return complete(b2, 'undelegated', { from, to });
      },
      (b) => complete(b, 'not_found', { from, to }),
    );

    return p as StorageProgram<Result>;
  },

  getEffectiveWeight(input: Record<string, unknown>) {
    const { participant } = input;
    let p = createProgram();
    // Stub: return base weight of 1 (real impl would traverse delegation graph)
    return complete(p, 'weight', { participant, effectiveWeight: 1.0, delegators: [] }) as StorageProgram<Result>;
  },
};

export const delegationHandler = autoInterpret(_delegationHandler);
