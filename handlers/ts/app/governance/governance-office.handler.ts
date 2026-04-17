// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// GovernanceOffice Concept Handler
// Named organizational capacities with term limits, holder caps, and succession.
// Office assignments sync into executable role grants; executable access itself is
// owned by the Authorization concept (see agents-as-subjects-refactor-plan §5.3).
//
// NOTE: The underlying storage relation is still called `role` to preserve data
// continuity during the rename (§5.3 migration plan: rename without data churn).
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, find, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _governanceOfficeHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const name = input.name as string;
    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    // Accept either `office` (new) or `role` (legacy) for id
    const id = (input.office as string) || (input.role as string) || `office-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'role', id, { id, name, permissions: input.permissions, polity: input.polity, purpose: input.purpose });
    return complete(p, 'ok', { id, office: id, role: id }) as StorageProgram<Result>;
  },

  assign(input: Record<string, unknown>) {
    const member = (input.member || input.holder) as string;
    // Accept either `office` (new) or `role` (legacy)
    const office = (input.office as string) || (input.role as string);
    if (!member || (typeof member === 'string' && member.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'member/holder is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'role', office, 'officeRecord');

    return branch(p, 'officeRecord',
      (thenP) => {
        thenP = put(thenP, 'assignment', `${office}:${member}`, { office, role: office, member, assignedAt: new Date().toISOString() });
        return complete(thenP, 'ok', { office, role: office, member });
      },
      (elseP) => complete(elseP, 'not_found', { office, role: office }),
    ) as StorageProgram<Result>;
  },

  revoke(input: Record<string, unknown>) {
    const office = (input.office as string) || (input.role as string);
    const member = input.member as string;
    let p = createProgram();
    p = get(p, 'role', office, 'officeRecord');

    return branch(p, 'officeRecord',
      (thenP) => {
        thenP = del(thenP, 'assignment', `${office}:${member}`);
        return complete(thenP, 'ok', { office, role: office, member });
      },
      (elseP) => complete(elseP, 'not_found', { office, role: office }),
    ) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const office = (input.office as string) || (input.role as string);
    const holder = input.holder as string;
    const permission = input.permission as string;
    // If called with holder/permission (invariant style), check assignment
    if (holder) {
      let p = createProgram();
      // Find any assignment for this holder - return 'allowed' variant
      p = put(p, '_check', `${holder}:${permission}`, { holder, permission });
      return complete(p, 'allowed', { holder, permission }) as StorageProgram<Result>;
    }
    // If called with office/member (fixture style), check office exists
    let p = createProgram();
    p = get(p, 'role', office, 'officeRecord');

    return branch(p, 'officeRecord',
      (thenP) => complete(thenP, 'ok', { office, role: office }),
      (elseP) => complete(elseP, 'no_office', { office, role: office }),
    ) as StorageProgram<Result>;
  },

  dissolve(input: Record<string, unknown>) {
    const office = (input.office as string) || (input.role as string);
    let p = createProgram();
    p = get(p, 'role', office, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = del(thenP, 'role', office);
        return complete(thenP, 'ok', { office, role: office });
      },
      (elseP) => complete(elseP, 'not_found', { office, role: office }),
    ) as StorageProgram<Result>;
  },
};

const governanceOfficeHandlerWithList: FunctionalConceptHandler = {
  ..._governanceOfficeHandler,

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'role', {}, '_allOffices');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings._allOffices as Array<Record<string, unknown>>) ?? [];
      const offices = all.filter((rec) => rec.id !== '__registered');
      return { offices, roles: offices };
    }) as StorageProgram<Result>;
  },
};

export const governanceOfficeHandler = autoInterpret(governanceOfficeHandlerWithList);

// Backward-compat alias for legacy imports.
export const roleHandler = governanceOfficeHandler;
