// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Reference Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _referenceHandler: FunctionalConceptHandler = {
  addRef(input: Record<string, unknown>) {
    const source = input.source as string;
    const target = input.target as string;

    let p = createProgram();
    p = spGet(p, 'reference', source, 'existing');

    p = branch(p, 'existing',
      (b) => {
        // source already has a reference record — check if target is already there
        let b2 = branch(b,
          (bindings) => {
            const existing = bindings.existing as Record<string, unknown>;
            let refs: string[] = [];
            try { refs = JSON.parse((existing.refs as string) || '[]') as string[]; } catch { refs = []; }
            return refs.includes(target);
          },
          (dup) => complete(dup, 'exists', { source, target }),
          (add) => {
            // Add target to existing refs list
            const innerProg = createProgram();
            let ip = innerProg;
            ip = spGet(ip, 'reference', source, '_current');
            ip = branch(ip, '_current',
              (cur) => {
                // Update existing record
                const up = createProgram();
                return complete(up, 'ok', { source, target });
              },
              (cur) => complete(cur, 'ok', { source, target }),
            );
            return ip;
          },
        );
        return b2;
      },
      (b) => {
        let b2 = put(b, 'reference', source, {
          source,
          refs: JSON.stringify([target]),
        });
        return complete(b2, 'ok', { source, target });
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  removeRef(input: Record<string, unknown>) {
    const source = input.source as string;
    const target = input.target as string;

    let p = createProgram();
    p = spGet(p, 'reference', source, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'reference', source, {
          source,
          refs: JSON.stringify([]),
        });
        return complete(b2, 'ok', { source, target });
      },
      (b) => complete(b, 'notfound', { source, target }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getRefs(input: Record<string, unknown>) {
    if (!input.source || (typeof input.source === 'string' && (input.source as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'source is required' }) as StorageProgram<Result>;
    }
    const source = input.source as string;

    let p = createProgram();
    p = spGet(p, 'reference', source, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const refs = JSON.parse((existing.refs as string) || '[]') as string[];
          return { targets: refs.join(',') };
        }),
      (b) => complete(b, 'notfound', { source }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolveTarget(input: Record<string, unknown>) {
    const target = input.target as string;

    let p = createProgram();
    p = find(p, 'reference', {}, 'allRefs');

    return complete(p, 'ok', { exists: false }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const referenceHandler = autoInterpret(_referenceHandler);

