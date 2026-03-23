// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, branch, complete, completeFrom, mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'digest';

const _handler: FunctionalConceptHandler = {
  compute(input: Record<string, unknown>) {
    const unit = input.unit as string;
    const algorithm = input.algorithm as string;

    if (!unit || unit.trim() === '') {
      return complete(createProgram(), 'error', { message: 'unit is required' }) as StorageProgram<Result>;
    }

    // Generate a deterministic-ish hash from the unit string
    const hashBase = `${algorithm}:${unit}`;
    let hash = 0;
    for (let i = 0; i < hashBase.length; i++) {
      hash = ((hash << 5) - hash + hashBase.charCodeAt(i)) | 0;
    }
    const digestId = `h${Math.abs(hash).toString(16).padStart(8, '0')}`;

    let p = createProgram();
    p = put(p, RELATION, digestId, { digest: digestId, hash: digestId, algorithm, unit });
    return complete(p, 'ok', { digest: digestId }) as StorageProgram<Result>;
  },

  lookup(input: Record<string, unknown>) {
    const hash = input.hash as string;

    if (!hash || hash.trim() === '') {
      return complete(createProgram(), 'error', { message: 'hash is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, RELATION, {}, 'all');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.all as Array<Record<string, unknown>>) || [];
      const matches = all.filter(r => r.hash === hash || r.digest === hash);
      return JSON.stringify(matches.map(r => r.unit));
    }, 'units');

    return completeFrom(p, 'ok', (bindings) => ({
      units: bindings.units as string,
    })) as StorageProgram<Result>;
  },

  equivalent(input: Record<string, unknown>) {
    const a = input.a as string;
    const b = input.b as string;

    if ((!a || (typeof a === 'string' && a.trim() === '')) &&
        (!b || (typeof b === 'string' && b.trim() === ''))) {
      return complete(createProgram(), 'error', { message: 'unit identifiers are required' }) as StorageProgram<Result>;
    }

    if (!a || (typeof a === 'string' && a.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'a is required' }) as StorageProgram<Result>;
    }

    if (!b || (typeof b === 'string' && b.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'b is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, RELATION, a as string, 'recordA');
    p = get(p, RELATION, b as string, 'recordB');

    return branch(p,
      (bindings) => {
        const rA = bindings.recordA as Record<string, unknown> | null;
        const rB = bindings.recordB as Record<string, unknown> | null;
        if (!rA || !rB) return false;
        return rA.hash === rB.hash;
      },
      (b2) => complete(b2, 'ok', {}),
      (b2) => complete(b2, 'no', { diffSummary: 'units differ or not found' }),
    ) as StorageProgram<Result>;
  },
};

export const contentDigestHandler = autoInterpret(_handler);
