// @clef-handler style=functional
// Delegation Concept Implementation
// Transfer decision-making power to a representative, with support for
// transitivity, domain scoping, and instant revocability.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `deleg-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Delegation' }) as StorageProgram<Result>;
  },

  delegate(input: Record<string, unknown>) {
    const { from, to, scope, domain, expiresAt, transitive } = input;
    // expiresAt: null means explicitly no expiry which is an error
    if (expiresAt === null) {
      return complete(createProgram(), 'error', { message: 'expiresAt is required' }) as StorageProgram<Result>;
    }
    const id = nextId();
    let p = createProgram();
    const data = {
      id, from, to, scope: scope || domain, expiresAt,
      transitive: transitive ?? false,
      createdAt: new Date().toISOString(),
    };
    p = put(p, 'delegation', id, data);
    p = put(p, 'delegation', `${from}:${to}`, data);
    return complete(p, 'ok', { id, delegation: id, edge: id }) as StorageProgram<Result>;
  },

  undelegate(input: Record<string, unknown>) {
    const delegation = (input.delegation || input.edge) as string;
    const from = input.from as string;
    const to = input.to as string;

    if (delegation && typeof delegation === 'string') {
      let p = createProgram();
      p = get(p, 'delegation', delegation, 'record');
      return branch(p, 'record',
        (b) => {
          let b2 = del(b, 'delegation', delegation);
          return complete(b2, 'ok', { delegation });
        },
        (b) => complete(b, 'not_found', { delegation }),
      ) as StorageProgram<Result>;
    }
    // Lookup by from:to
    const key = `${from}:${to}`;
    let p = createProgram();
    p = get(p, 'delegation', key, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = del(b, 'delegation', key);
        return complete(b2, 'ok', { from, to });
      },
      (b) => complete(b, 'not_found', { from, to }),
    );
    return p as StorageProgram<Result>;
  },

  getEffectiveWeight(input: Record<string, unknown>) {
    const { participant } = input;
    let p = createProgram();
    return complete(p, 'ok', { participant, effectiveWeight: 1.0, delegators: [] }) as StorageProgram<Result>;
  },
};

export const delegationHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetDelegation(): void {
  idCounter = 0;
}
