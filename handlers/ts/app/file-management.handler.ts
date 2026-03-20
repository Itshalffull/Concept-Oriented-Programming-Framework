// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _fileManagementHandler: FunctionalConceptHandler = {
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
    return completeFrom(p, 'ok', (bindings) => {
      const allFiles = (bindings.allFiles as Array<Record<string, unknown>>) || [];
      const unused = allFiles.filter(f => {
        const usages = JSON.parse((f.usages as string) || '[]') as string[];
        return usages.length === 0;
      });
      return { removed: unused.length };
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getFile(input: Record<string, unknown>) {
    const file = input.file as string;

    let p = createProgram();
    p = spGet(p, 'file', file, 'record');
    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { data: (record.data as string) || '', mimeType: (record.mimeType as string) || '' };
        }),
      (b) => complete(b, 'notfound', { message: 'File not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const fileManagementHandler = autoInterpret(_fileManagementHandler);

