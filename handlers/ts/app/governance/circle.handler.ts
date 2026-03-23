// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Circle Concept Handler
// Nested governance groups with holacratic jurisdiction management.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _circleHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const id = `circle-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'circle', id, {
      id, name: input.name, domain: input.domain, purpose: input.purpose ?? null,
      parent: input.parent ?? null, members: [], createdAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { id, circle: id }) as StorageProgram<Result>;
  },

  assignMember(input: Record<string, unknown>) {
    const { circle, member, role } = input;
    let p = createProgram();
    p = get(p, 'circle', circle as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'circle', circle as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const members = (record.members as string[]);
          if (!members.includes(member as string)) members.push(member as string);
          return { ...record, members };
        });
        return complete(thenP, 'ok', { circle, member });
      },
      (elseP) => complete(elseP, 'not_found', { circle }),
    ) as StorageProgram<Result>;
  },

  removeMember(input: Record<string, unknown>) {
    const { circle, member } = input;
    let p = createProgram();
    p = get(p, 'circle', circle as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'circle', circle as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const members = (record.members as string[]).filter(m => m !== member);
          return { ...record, members };
        });
        return complete(thenP, 'ok', { circle, member });
      },
      (elseP) => complete(elseP, 'not_found', { circle }),
    ) as StorageProgram<Result>;
  },

  setLinks(input: Record<string, unknown>) {
    const { circle, leadLink, repLink } = input;
    let p = createProgram();
    p = get(p, 'circle', circle as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'circle', circle as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, leadLink, repLink };
        });
        return complete(thenP, 'ok', { circle });
      },
      (elseP) => complete(elseP, 'not_found', { circle }),
    ) as StorageProgram<Result>;
  },

  dissolve(input: Record<string, unknown>) {
    const { circle } = input;
    let p = createProgram();
    p = get(p, 'circle', circle as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        let b2 = del(thenP, 'circle', circle as string);
        return complete(b2, 'ok', { circle });
      },
      (elseP) => complete(elseP, 'not_found', { circle }),
    ) as StorageProgram<Result>;
  },

  checkJurisdiction(input: Record<string, unknown>) {
    const { circle, action } = input;
    let p = createProgram();
    p = get(p, 'circle', circle as string, 'record');

    return branch(p, 'record',
      (thenP) => complete(thenP, 'ok', { circle, action }),
      (elseP) => complete(elseP, 'not_found', { circle }),
    ) as StorageProgram<Result>;
  },
};

export const circleHandler = autoInterpret(_circleHandler);
