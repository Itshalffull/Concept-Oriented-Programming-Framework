// @clef-handler style=functional
// Team Concept Implementation
// Organize governance into semi-autonomous nested groups with defined
// jurisdictions and subsidiarity.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `team-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Team' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && input.name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    const now = new Date().toISOString();
    const parent = input.parent as string | null | undefined;

    let p = createProgram();
    p = put(p, 'team', id, {
      id,
      name: input.name,
      domain: input.domain,
      parent: parent || null,
      children: [],
      members: [],
      policies: [],
      repLink: null,
      leadLink: null,
      createdAt: now,
    });

    return complete(p, 'ok', { id, team: id }) as StorageProgram<Result>;
  },

  assignMember(input: Record<string, unknown>) {
    const team = input.team as string;
    const member = input.member as string;

    let p = createProgram();
    p = get(p, 'team', team, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'team', team, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const members = (record.members as string[]) || [];
          if (!members.includes(member as string)) members.push(member as string);
          return { ...record, members };
        });
        return complete(thenP, 'ok', { team, member });
      },
      (elseP) => complete(elseP, 'not_found', { team }),
    ) as StorageProgram<Result>;
  },

  removeMember(input: Record<string, unknown>) {
    const team = input.team as string;
    const member = input.member as string;

    let p = createProgram();
    p = get(p, 'team', team, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'team', team, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const members = ((record.members as string[]) || []).filter(m => m !== member);
          return { ...record, members };
        });
        return complete(thenP, 'ok', { team, member });
      },
      (elseP) => complete(elseP, 'not_found', { team }),
    ) as StorageProgram<Result>;
  },

  setLinks(input: Record<string, unknown>) {
    const team = input.team as string;
    const repLink = input.repLink;
    const leadLink = input.leadLink;

    let p = createProgram();
    p = get(p, 'team', team, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'team', team, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, leadLink, repLink };
        });
        return complete(thenP, 'ok', { team });
      },
      (elseP) => complete(elseP, 'not_found', { team }),
    ) as StorageProgram<Result>;
  },

  dissolve(input: Record<string, unknown>) {
    const team = input.team as string;

    let p = createProgram();
    p = get(p, 'team', team, 'record');

    return branch(p, 'record',
      (thenP) => {
        let b2 = del(thenP, 'team', team);
        return complete(b2, 'ok', { team });
      },
      (elseP) => complete(elseP, 'not_found', { team }),
    ) as StorageProgram<Result>;
  },

  checkJurisdiction(input: Record<string, unknown>) {
    const team = input.team as string;
    const action = input.action as string;

    let p = createProgram();
    p = get(p, 'team', team, 'record');

    return branch(p, 'record',
      (thenP) => complete(thenP, 'ok', { team, action }),
      (elseP) => complete(elseP, 'not_found', { team }),
    ) as StorageProgram<Result>;
  },
};

export const teamHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetTeam(): void {
  idCounter = 0;
}
