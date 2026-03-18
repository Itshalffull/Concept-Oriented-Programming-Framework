// @migrated dsl-constructs 2026-03-18
// SyncedContent Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, del, putFrom, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const syncedContentHandlerFunctional: FunctionalConceptHandler = {
  createReference(input: Record<string, unknown>) {
    const ref = input.ref as string;
    const original = input.original as string;

    let p = createProgram();
    p = spGet(p, 'syncedContent', original, 'originalRecord');
    p = branch(p, 'originalRecord',
      (b) => {
        let b2 = putFrom(b, 'syncedContent', original, (bindings) => {
          const rec = bindings.originalRecord as Record<string, unknown>;
          const references = JSON.parse((rec.references as string) || '[]') as string[];
          references.push(ref);
          return { ...rec, references: JSON.stringify(references) };
        });
        b2 = putFrom(b2, 'syncedContent', ref, (bindings) => {
          const rec = bindings.originalRecord as Record<string, unknown>;
          return { ref, originalId: original, content: rec.content as string, references: '[]', isReference: true };
        });
        return complete(b2, 'ok', {});
      },
      (b) => {
        let b2 = put(b, 'syncedContent', original, { original, content: '', references: JSON.stringify([ref]), isReference: false });
        b2 = put(b2, 'syncedContent', ref, { ref, originalId: original, content: '', references: '[]', isReference: true });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  editOriginal(input: Record<string, unknown>) {
    const original = input.original as string;
    const content = input.content as string;

    let p = createProgram();
    p = spGet(p, 'syncedContent', original, 'originalRecord');
    p = putFrom(p, 'syncedContent', original, (bindings) => {
      const rec = (bindings.originalRecord as Record<string, unknown>) || { original, content: '', references: '[]', isReference: false };
      return { ...rec, content };
    });
    // Note: propagation to references would require sequential gets/puts for each ref.
    // In the functional style, we store the updated content; sync propagation is handled by the interpreter.
    return complete(p, 'ok', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  deleteReference(input: Record<string, unknown>) {
    const ref = input.ref as string;

    let p = createProgram();
    p = spGet(p, 'syncedContent', ref, 'refRecord');
    p = branch(p, 'refRecord',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.refRecord as Record<string, unknown>;
          return rec.originalId as string;
        }, 'originalId');
        b2 = del(b2, 'syncedContent', ref);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Reference does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  convertToIndependent(input: Record<string, unknown>) {
    const ref = input.ref as string;

    let p = createProgram();
    p = spGet(p, 'syncedContent', ref, 'refRecord');
    p = branch(p, 'refRecord',
      (b) => {
        let b2 = putFrom(b, 'syncedContent', ref, (bindings) => {
          const rec = bindings.refRecord as Record<string, unknown>;
          return { ...rec, originalId: '', isReference: false };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Reference does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const syncedContentHandler = wrapFunctional(syncedContentHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { syncedContentHandlerFunctional };
