// @migrated dsl-constructs 2026-03-18
// Reference Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _referenceHandler: FunctionalConceptHandler = {
  addRef(input: Record<string, unknown>) {
    const source = input.source as string;
    const target = input.target as string;

    let p = createProgram();
    p = spGet(p, 'reference', source, 'existing');

    p = put(p, 'reference', source, {
      source,
      refs: JSON.stringify([target]),
    });

    return complete(p, 'ok', { source, target }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
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
    const source = input.source as string;

    let p = createProgram();
    p = spGet(p, 'reference', source, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { targets: '' }),
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

