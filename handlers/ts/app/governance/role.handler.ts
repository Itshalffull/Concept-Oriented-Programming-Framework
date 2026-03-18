// @migrated dsl-constructs 2026-03-18
// Role Concept Handler
// Named capacities with permissions, assignment, and revocation.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _roleHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const id = `role-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'role', id, { id, name: input.name, permissions: input.permissions, polity: input.polity });
    return complete(p, 'created', { role: id }) as StorageProgram<Result>;
  },

  assign(input: Record<string, unknown>) {
    const { role, member, assignedBy } = input;
    let p = createProgram();
    p = put(p, 'assignment', `${role}:${member}`, { role, member, assignedBy, assignedAt: new Date().toISOString() });
    return complete(p, 'assigned', { assignment: `${role}:${member}` }) as StorageProgram<Result>;
  },

  revoke(input: Record<string, unknown>) {
    const { role, member } = input;
    const key = `${role}:${member}`;
    let p = createProgram();
    p = get(p, 'assignment', key, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = del(b, 'assignment', key);
        return complete(b2, 'revoked', { role, member });
      },
      (b) => complete(b, 'not_assigned', { role, member }),
    );

    return p as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const { role, member } = input;
    let p = createProgram();
    p = get(p, 'assignment', `${role}:${member}`, 'record');

    p = branch(p, 'record',
      (b) => complete(b, 'has_role', { role, member }),
      (b) => complete(b, 'no_role', { role, member }),
    );

    return p as StorageProgram<Result>;
  },

  dissolve(input: Record<string, unknown>) {
    const { role } = input;
    let p = createProgram();
    p = del(p, 'role', role as string);
    return complete(p, 'dissolved', { role }) as StorageProgram<Result>;
  },
};

export const roleHandler = autoInterpret(_roleHandler);
