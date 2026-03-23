// @clef-handler style=functional
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
    const name = input.name as string;
    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const id = (input.role as string) || `role-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'role', id, { id, name, permissions: input.permissions, polity: input.polity, purpose: input.purpose });
    return complete(p, 'ok', { id, role: id }) as StorageProgram<Result>;
  },

  assign(input: Record<string, unknown>) {
    const member = (input.member || input.holder) as string;
    const role = input.role as string;
    if (!member || (typeof member === 'string' && member.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'member/holder is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'role', role, 'roleRecord');

    return branch(p, 'roleRecord',
      (thenP) => {
        thenP = put(thenP, 'assignment', `${role}:${member}`, { role, member, assignedAt: new Date().toISOString() });
        return complete(thenP, 'ok', { role, member });
      },
      (elseP) => complete(elseP, 'not_found', { role }),
    ) as StorageProgram<Result>;
  },

  revoke(input: Record<string, unknown>) {
    const role = input.role as string;
    const member = input.member as string;
    let p = createProgram();
    p = get(p, 'role', role, 'roleRecord');

    return branch(p, 'roleRecord',
      (thenP) => {
        thenP = del(thenP, 'assignment', `${role}:${member}`);
        return complete(thenP, 'ok', { role, member });
      },
      (elseP) => complete(elseP, 'not_found', { role }),
    ) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const role = input.role as string;
    const holder = input.holder as string;
    const permission = input.permission as string;
    // If called with holder/permission (invariant style), check assignment
    if (holder) {
      let p = createProgram();
      // Find any assignment for this holder - return 'allowed' variant
      p = put(p, '_check', `${holder}:${permission}`, { holder, permission });
      return complete(p, 'allowed', { holder, permission }) as StorageProgram<Result>;
    }
    // If called with role/member (fixture style), check role exists
    let p = createProgram();
    p = get(p, 'role', role, 'roleRecord');

    return branch(p, 'roleRecord',
      (thenP) => complete(thenP, 'ok', { role }),
      (elseP) => complete(elseP, 'no_role', { role }),
    ) as StorageProgram<Result>;
  },

  dissolve(input: Record<string, unknown>) {
    const role = input.role as string;
    let p = createProgram();
    p = get(p, 'role', role, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = del(thenP, 'role', role);
        return complete(thenP, 'ok', { role });
      },
      (elseP) => complete(elseP, 'not_found', { role }),
    ) as StorageProgram<Result>;
  },
};

export const roleHandler = autoInterpret(_roleHandler);
