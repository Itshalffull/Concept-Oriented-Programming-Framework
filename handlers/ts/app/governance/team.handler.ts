// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Team Concept Handler
// Nested governance groups with holacratic jurisdiction management.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _teamHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const id = `team-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'team', id, {
      id, name: input.name, domain: input.domain, purpose: input.purpose ?? null,
      parent: input.parent ?? null, members: [], createdAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { id, team: id }) as StorageProgram<Result>;
  },

  assignMember(input: Record<string, unknown>) {
    const { team, member, role } = input;
    let p = createProgram();
    p = get(p, 'team', team as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'team', team as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const members = (record.members as string[]);
          if (!members.includes(member as string)) members.push(member as string);
          return { ...record, members };
        });
        return complete(thenP, 'ok', { team, member });
      },
      (elseP) => complete(elseP, 'not_found', { team }),
    ) as StorageProgram<Result>;
  },

  removeMember(input: Record<string, unknown>) {
    const { team, member } = input;
    let p = createProgram();
    p = get(p, 'team', team as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'team', team as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const members = (record.members as string[]).filter(m => m !== member);
          return { ...record, members };
        });
        return complete(thenP, 'ok', { team, member });
      },
      (elseP) => complete(elseP, 'not_found', { team }),
    ) as StorageProgram<Result>;
  },

  setLinks(input: Record<string, unknown>) {
    const { team, leadLink, repLink } = input;
    let p = createProgram();
    p = get(p, 'team', team as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'team', team as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, leadLink, repLink };
        });
        return complete(thenP, 'ok', { team });
      },
      (elseP) => complete(elseP, 'not_found', { team }),
    ) as StorageProgram<Result>;
  },

  dissolve(input: Record<string, unknown>) {
    const { team } = input;
    let p = createProgram();
    p = get(p, 'team', team as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        let b2 = del(thenP, 'team', team as string);
        return complete(b2, 'ok', { team });
      },
      (elseP) => complete(elseP, 'not_found', { team }),
    ) as StorageProgram<Result>;
  },

  checkJurisdiction(input: Record<string, unknown>) {
    const { team, action } = input;
    let p = createProgram();
    p = get(p, 'team', team as string, 'record');

    return branch(p, 'record',
      (thenP) => complete(thenP, 'ok', { team, action }),
      (elseP) => complete(elseP, 'not_found', { team }),
    ) as StorageProgram<Result>;
  },
};

export const teamHandler = autoInterpret(_teamHandler);
