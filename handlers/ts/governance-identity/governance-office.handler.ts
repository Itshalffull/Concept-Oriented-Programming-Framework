// @clef-handler style=functional
// GovernanceOffice Concept Implementation
// Named organizational capacities with term limits, holder caps, and succession.
// Office assignments sync into executable role grants; executable access itself
// is owned by the Authorization concept (see agents-as-subjects-refactor-plan §5.3).
//
// NOTE: The underlying storage relation is still called `role` to preserve data
// continuity during the rename.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `office-${++idCounter}`;
}

// Accept the new canonical `office` input key as well as the legacy `role` key.
function extractOfficeId(input: Record<string, unknown>): string {
  return (input.office as string) || (input.role as string) || '';
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

    return complete(p, 'ok', { office: id, role: id }) as StorageProgram<Result>;
  },

  assign(input: Record<string, unknown>) {
    const office = extractOfficeId(input);
    const member = input.member as string;

    if (!member || member.trim() === '') {
      return complete(createProgram(), 'error', { message: 'member is required' }) as StorageProgram<Result>;
    }
    if (!office || office.trim() === '') {
      return complete(createProgram(), 'error', { message: 'office is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'role', office, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { office, role: office }),
      (() => {
        let b = createProgram();
        b = get(b, 'role', office, 'rec');
        b = putFrom(b, 'role', office, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const holders = (rec.holders as string[]) || [];
          if (holders.includes(member)) return rec;
          return { ...rec, holders: [...holders, member] };
        });
        return complete(b, 'ok', { assignment: office, office, role: office, member });
      })(),
    ) as StorageProgram<Result>;
  },

  revoke(input: Record<string, unknown>) {
    const office = extractOfficeId(input);
    const member = input.member as string;

    if (!office || office.trim() === '') {
      return complete(createProgram(), 'error', { message: 'office is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'role', office, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      // Office not found — return ok per spec (member does not hold this office)
      complete(createProgram(), 'ok', { office, role: office, member }),
      (() => {
        let b = createProgram();
        b = get(b, 'role', office, 'rec');
        b = putFrom(b, 'role', office, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const holders = (rec.holders as string[]) || [];
          return { ...rec, holders: holders.filter((h: string) => h !== member) };
        });
        return complete(b, 'ok', { office, role: office, member });
      })(),
    ) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const office = extractOfficeId(input);
    const member = input.member as string;

    if (!office || office.trim() === '') {
      return complete(createProgram(), 'error', { message: 'office is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'role', office, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      // Office not found — return ok per spec (member does not hold this office)
      complete(createProgram(), 'ok', { office, role: office, member }),
      (() => {
        let b = createProgram();
        b = get(b, 'role', office, 'rec');
        return branch(b,
          (bindings) => {
            const rec = bindings.rec as Record<string, unknown>;
            const holders = (rec.holders as string[]) || [];
            return holders.includes(member);
          },
          complete(createProgram(), 'ok', { office, role: office, member }),
          complete(createProgram(), 'ok', { office, role: office, member }),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  dissolve(input: Record<string, unknown>) {
    const office = extractOfficeId(input);

    if (!office || office.trim() === '') {
      return complete(createProgram(), 'error', { message: 'office is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'role', office, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { office, role: office }),
      (() => {
        let b = createProgram();
        b = del(b, 'role', office);
        return complete(b, 'ok', { office, role: office });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const governanceOfficeHandler = autoInterpret(_handler);

// Backward-compat alias for legacy imports (Role concept rename).
export const roleHandler = governanceOfficeHandler;

/** Reset internal state. Useful for testing. */
export function resetGovernanceOffice(): void {
  idCounter = 0;
}

// Backward-compat alias
export const resetRole = resetGovernanceOffice;
