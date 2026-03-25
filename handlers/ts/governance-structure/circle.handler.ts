// @clef-handler style=functional
// Circle Concept Implementation
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
  return `circle-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Circle' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && input.name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    const now = new Date().toISOString();
    const parent = input.parent as string | null | undefined;

    let p = createProgram();
    p = put(p, 'circle', id, {
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

    return complete(p, 'ok', { id, circle: id }) as StorageProgram<Result>;
  },

  assignMember(input: Record<string, unknown>) {
    const circle = input.circle as string;
    const member = input.member as string;

    let p = createProgram();
    p = get(p, 'circle', circle, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'circle', circle, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const members = (record.members as string[]) || [];
          if (!members.includes(member as string)) members.push(member as string);
          return { ...record, members };
        });
        return complete(thenP, 'ok', { circle, member });
      },
      (elseP) => complete(elseP, 'not_found', { circle }),
    ) as StorageProgram<Result>;
  },

  removeMember(input: Record<string, unknown>) {
    const circle = input.circle as string;
    const member = input.member as string;

    let p = createProgram();
    p = get(p, 'circle', circle, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'circle', circle, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const members = ((record.members as string[]) || []).filter(m => m !== member);
          return { ...record, members };
        });
        return complete(thenP, 'ok', { circle, member });
      },
      (elseP) => complete(elseP, 'not_found', { circle }),
    ) as StorageProgram<Result>;
  },

  setLinks(input: Record<string, unknown>) {
    const circle = input.circle as string;
    const repLink = input.repLink;
    const leadLink = input.leadLink;

    let p = createProgram();
    p = get(p, 'circle', circle, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'circle', circle, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, leadLink, repLink };
        });
        return complete(thenP, 'ok', { circle });
      },
      (elseP) => complete(elseP, 'not_found', { circle }),
    ) as StorageProgram<Result>;
  },

  dissolve(input: Record<string, unknown>) {
    const circle = input.circle as string;

    let p = createProgram();
    p = get(p, 'circle', circle, 'record');

    return branch(p, 'record',
      (thenP) => {
        let b2 = del(thenP, 'circle', circle);
        return complete(b2, 'ok', { circle });
      },
      (elseP) => complete(elseP, 'not_found', { circle }),
    ) as StorageProgram<Result>;
  },

  checkJurisdiction(input: Record<string, unknown>) {
    const circle = input.circle as string;
    const action = input.action as string;

    let p = createProgram();
    p = get(p, 'circle', circle, 'record');

    return branch(p, 'record',
      (thenP) => complete(thenP, 'ok', { circle, action }),
      (elseP) => complete(elseP, 'not_found', { circle }),
    ) as StorageProgram<Result>;
  },
};

export const circleHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetCircle(): void {
  idCounter = 0;
}
