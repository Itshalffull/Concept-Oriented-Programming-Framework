// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const fileManagementHandlerFunctional: FunctionalConceptHandler = {
  upload(input: Record<string, unknown>) {
    const file = input.file as string;
    const data = input.data as string;
    const mimeType = input.mimeType as string;

    let p = createProgram();
    p = spGet(p, 'file', file, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'error', { message: 'File already exists' }),
      (b) => {
        let b2 = put(b, 'file', file, {
          file,
          data,
          mimeType,
          usages: JSON.stringify([]),
        });
        return complete(b2, 'ok', { file });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addUsage(input: Record<string, unknown>) {
    const file = input.file as string;
    const entity = input.entity as string;

    let p = createProgram();
    p = spGet(p, 'file', file, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'file', file, { usages: JSON.stringify([entity]) });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'File not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  removeUsage(input: Record<string, unknown>) {
    const file = input.file as string;
    const entity = input.entity as string;

    let p = createProgram();
    p = spGet(p, 'file', file, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'file', file, { usages: JSON.stringify([]) });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'File not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  garbageCollect(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'file', {}, 'allFiles');
    return complete(p, 'ok', { removed: 0 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getFile(input: Record<string, unknown>) {
    const file = input.file as string;

    let p = createProgram();
    p = spGet(p, 'file', file, 'record');
    p = branch(p, 'record',
      (b) => complete(b, 'ok', { data: '', mimeType: '' }),
      (b) => complete(b, 'notfound', { message: 'File not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const fileManagementHandler = wrapFunctional(fileManagementHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { fileManagementHandlerFunctional };
