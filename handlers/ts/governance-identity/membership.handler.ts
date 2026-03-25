// @clef-handler style=functional
// Membership Concept Implementation
// Track who belongs to a governance body and enforce entry/exit rules.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `membership-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  join(input: Record<string, unknown>) {
    const member = input.member as string;
    const polity = input.polity as string;

    if (!member || member.trim() === '') {
      return complete(createProgram(), 'error', { message: 'member is required' }) as StorageProgram<Result>;
    }

    const key = `${member}:${polity || ''}`;
    let p = createProgram();
    p = get(p, 'membership', key, 'existing');

    return branch(p,
      (bindings) => !!bindings.existing,
      // Already a member — return ok with member string
      complete(createProgram(), 'ok', { member }),
      (() => {
        const id = nextId();
        let b = createProgram();
        b = put(b, 'membership', key, {
          id,
          member: member.trim(),
          polity: polity || '',
          status: 'Active',
          joinedAt: new Date().toISOString(),
          joinRules: '',
          exitRules: '',
          evidence: [],
          metadata: { displayName: null, identityRef: null },
        });
        return complete(b, 'ok', { membership: id });
      })(),
    ) as StorageProgram<Result>;
  },

  leave(input: Record<string, unknown>) {
    const member = input.member as string;

    if (!member || member.trim() === '') {
      return complete(createProgram(), 'error', { message: 'member is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    // Find by member field
    p = get(p, 'membership', member, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { member }),
      (() => {
        // Delete the record — use put to mark as Exited, or just del
        let b = createProgram();
        b = get(b, 'membership', member, 'rec');
        b = putFrom(b, 'membership', member, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          return { ...rec, status: 'Exited' };
        });
        return complete(b, 'ok', { member });
      })(),
    ) as StorageProgram<Result>;
  },

  suspend(input: Record<string, unknown>) {
    const member = input.member as string;
    const until = (input.until as string) || null;

    if (!member || member.trim() === '') {
      return complete(createProgram(), 'error', { message: 'member is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'membership', member, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { member }),
      (() => {
        let b = createProgram();
        b = get(b, 'membership', member, 'rec');
        b = putFrom(b, 'membership', member, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          return { ...rec, status: 'Suspended', suspendedUntil: until };
        });
        return complete(b, 'ok', { member });
      })(),
    ) as StorageProgram<Result>;
  },

  reinstate(input: Record<string, unknown>) {
    const member = input.member as string;

    if (!member || member.trim() === '') {
      return complete(createProgram(), 'error', { message: 'member is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'membership', member, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { member }),
      (() => {
        let b = createProgram();
        b = get(b, 'membership', member, 'rec');
        b = putFrom(b, 'membership', member, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          return { ...rec, status: 'Active', suspendedUntil: null };
        });
        return complete(b, 'ok', { member });
      })(),
    ) as StorageProgram<Result>;
  },

  kick(input: Record<string, unknown>) {
    const member = input.member as string;

    if (!member || member.trim() === '') {
      return complete(createProgram(), 'error', { message: 'member is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'membership', member, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { member }),
      (() => {
        let b = createProgram();
        b = get(b, 'membership', member, 'rec');
        b = putFrom(b, 'membership', member, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          return { ...rec, status: 'Exited', kickedAt: new Date().toISOString() };
        });
        return complete(b, 'ok', { member });
      })(),
    ) as StorageProgram<Result>;
  },

  updateRules(input: Record<string, unknown>) {
    const polity = input.polity as string;
    const joinConditions = input.joinConditions as string;
    const exitConditions = input.exitConditions as string;

    if (!polity || polity.trim() === '') {
      return complete(createProgram(), 'error', { message: 'polity is required' }) as StorageProgram<Result>;
    }

    // Store polity-level rules under a polity key
    let p = createProgram();
    p = put(p, 'polityRules', polity, {
      polity: polity.trim(),
      joinRules: joinConditions || '',
      exitRules: exitConditions || '',
      updatedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { polity }) as StorageProgram<Result>;
  },
};

export const membershipHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetMembership(): void {
  idCounter = 0;
}
