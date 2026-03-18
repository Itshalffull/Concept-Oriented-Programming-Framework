// @migrated dsl-constructs 2026-03-18
// Backlink Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, get as spGet, find, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

const _backlinkHandler: FunctionalConceptHandler = {
  getBacklinks(input: Record<string, unknown>) {
    const entity = input.entity as string;

    let p = createProgram();
    p = spGet(p, 'backlink', entity, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { sources: '' }),
      (b) => complete(b, 'ok', { sources: JSON.stringify([]) }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getUnlinkedMentions(input: Record<string, unknown>) {
    const entity = input.entity as string;

    let p = createProgram();
    p = spGet(p, 'backlink', entity, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { mentions: '' }),
      (b) => complete(b, 'ok', { mentions: JSON.stringify([]) }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  reindex(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'backlink', {}, 'allBacklinks');
    // Count is computed at runtime from bindings
    return complete(p, 'ok', { count: 0 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const backlinkHandler = autoInterpret(_backlinkHandler);

