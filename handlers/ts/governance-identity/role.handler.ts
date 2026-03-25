// @clef-handler style=functional
// Role Concept Implementation
// Assign named capacities with defined permissions to participants.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `role-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const permissions = input.permissions as string;
    const polity = input.polity as string;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'role', id, {
      id,
      name: name.trim(),
      purpose: '',
      permissions: permissions ? permissions.split(',').map((s: string) => s.trim()) : [],
      holders: [],
      hierarchy: [],
      polity: polity || '',
      termExpiry: null,
      maxHolders: null,
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { role: id }) as StorageProgram<Result>;
  },

  assign(input: Record<string, unknown>) {
    const role = input.role as string;
    const member = input.member as string;
    const assignedBy = input.assignedBy as string;

    if (!member || member.trim() === '') {
      return complete(createProgram(), 'error', { message: 'member is required' }) as StorageProgram<Result>;
    }
    if (!role || role.trim() === '') {
      return complete(createProgram(), 'error', { message: 'role is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'role', role, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { role }),
      (() => {
        let b = createProgram();
        b = get(b, 'role', role, 'rec');
        b = putFrom(b, 'role', role, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const holders = (rec.holders as string[]) || [];
          if (holders.includes(member)) return rec;
          return { ...rec, holders: [...holders, member] };
        });
        return complete(b, 'ok', { assignment: role, role, member });
      })(),
    ) as StorageProgram<Result>;
  },

  revoke(input: Record<string, unknown>) {
    const role = input.role as string;
    const member = input.member as string;

    if (!role || role.trim() === '') {
      return complete(createProgram(), 'error', { message: 'role is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'role', role, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      // Role not found — return ok per spec (member does not hold this role)
      complete(createProgram(), 'ok', { role, member }),
      (() => {
        let b = createProgram();
        b = get(b, 'role', role, 'rec');
        b = putFrom(b, 'role', role, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const holders = (rec.holders as string[]) || [];
          return { ...rec, holders: holders.filter((h: string) => h !== member) };
        });
        return complete(b, 'ok', { role, member });
      })(),
    ) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const role = input.role as string;
    const member = input.member as string;

    if (!role || role.trim() === '') {
      return complete(createProgram(), 'error', { message: 'role is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'role', role, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      // Role not found — return ok per spec (member does not hold this role)
      complete(createProgram(), 'ok', { role, member }),
      (() => {
        let b = createProgram();
        b = get(b, 'role', role, 'rec');
        return branch(b,
          (bindings) => {
            const rec = bindings.rec as Record<string, unknown>;
            const holders = (rec.holders as string[]) || [];
            return holders.includes(member);
          },
          complete(createProgram(), 'ok', { role, member }),
          complete(createProgram(), 'ok', { role, member }),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  dissolve(input: Record<string, unknown>) {
    const role = input.role as string;

    if (!role || role.trim() === '') {
      return complete(createProgram(), 'error', { message: 'role is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'role', role, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { role }),
      (() => {
        let b = createProgram();
        b = del(b, 'role', role);
        return complete(b, 'ok', { role });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const roleHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetRole(): void {
  idCounter = 0;
}
