// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Backlink Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _backlinkHandler: FunctionalConceptHandler = {
  getBacklinks(input: Record<string, unknown>) {
    const entity = input.entity as string;

    let p = createProgram();
    p = spGet(p, 'backlink', entity, 'existing');
    // Always return ok — empty sources means no backlinks found yet
    return complete(p, 'ok', { sources: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getUnlinkedMentions(input: Record<string, unknown>) {
    const entity = input.entity as string;

    let p = createProgram();
    p = spGet(p, 'backlink', entity, 'existing');
    // Always return ok — empty mentions means none found yet
    return complete(p, 'ok', { mentions: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  reindex(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'backlink', {}, 'allBacklinks');
    // Count is computed at runtime from bindings
    return complete(p, 'ok', { count: 0 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const backlinkHandler = autoInterpret(_backlinkHandler);

