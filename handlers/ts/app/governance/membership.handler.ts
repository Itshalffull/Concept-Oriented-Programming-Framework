// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Membership Concept Handler
// Manage members joining, leaving, and participating in a governed polity.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _membershipHandler: FunctionalConceptHandler = {
  join(input: Record<string, unknown>) {
    const member = input.member as string;
    const polity = input.polity as string;
    let p = createProgram();
    p = get(p, 'member', member, 'existing');

    p = branch(p, 'existing',
      (b) => complete(b, 'already_member', { member }),
      (b) => {
        let b2 = put(b, 'member', member, { member, polity, status: 'Active', joinedAt: new Date().toISOString() });
        return complete(b2, 'ok', { membership: member });
      },
    );

    return p as StorageProgram<Result>;
  },

  leave(input: Record<string, unknown>) {
    const member = input.member as string;
    let p = createProgram();
    p = get(p, 'member', member, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = del(b, 'member', member);
        return complete(b2, 'ok', { member });
      },
      (b) => complete(b, 'not_found', { member }),
    );

    return p as StorageProgram<Result>;
  },

  suspend(input: Record<string, unknown>) {
    const member = input.member as string;
    let p = createProgram();
    p = get(p, 'member', member, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'member', member, { ...(input as Record<string, unknown>), status: 'Suspended', suspendedUntil: input.until });
        return complete(b2, 'suspended', { member });
      },
      (b) => complete(b, 'not_found', { member }),
    );

    return p as StorageProgram<Result>;
  },

  reinstate(input: Record<string, unknown>) {
    const member = input.member as string;
    let p = createProgram();
    p = get(p, 'member', member, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'member', member, { status: 'Active', suspendedUntil: null });
        return complete(b2, 'ok', { member });
      },
      (b) => complete(b, 'not_found', { member }),
    );

    return p as StorageProgram<Result>;
  },

  kick(input: Record<string, unknown>) {
    const member = input.member as string;
    let p = createProgram();
    p = get(p, 'member', member, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = del(b, 'member', member);
        return complete(b2, 'ok', { member });
      },
      (b) => complete(b, 'not_found', { member }),
    );

    return p as StorageProgram<Result>;
  },

  updateRules(input: Record<string, unknown>) {
    const polity = input.polity as string;
    let p = createProgram();
    p = put(p, 'rules', polity, { joinConditions: input.joinConditions, exitConditions: input.exitConditions });
    return complete(p, 'ok', { polity }) as StorageProgram<Result>;
  },
};

export const membershipHandler = autoInterpret(_membershipHandler);
