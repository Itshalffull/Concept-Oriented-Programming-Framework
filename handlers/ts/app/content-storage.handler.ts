// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _contentStorageHandler: FunctionalConceptHandler = {
  save(input: Record<string, unknown>) {
    if (!input.record || (typeof input.record === 'string' && (input.record as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'record is required' }) as StorageProgram<Result>;
    }
    const record = input.record as string;
    const data = input.data as string;

    let p = createProgram();
    p = put(p, 'record', record, { record, data });
    return complete(p, 'ok', { record }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  load(input: Record<string, unknown>) {
    const record = input.record as string;

    let p = createProgram();
    p = spGet(p, 'record', record, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { record, data: (existing.data as string) || '' };
        }),
      (b) => complete(b, 'notfound', { message: 'not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  delete(input: Record<string, unknown>) {
    const record = input.record as string;

    let p = createProgram();
    p = spGet(p, 'record', record, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'record', record);
        return complete(b2, 'ok', { record });
      },
      (b) => complete(b, 'notfound', { message: 'not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  query(input: Record<string, unknown>) {
    if (!input.filter || (typeof input.filter === 'string' && (input.filter as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'filter is required' }) as StorageProgram<Result>;
    }
    const filter = input.filter as string;

    let p = createProgram();
    p = find(p, 'record', filter as unknown as Record<string, unknown>, 'results');
    return completeFrom(p, 'ok', (bindings) => ({ results: JSON.stringify((bindings.results as Array<Record<string, unknown>>) || []) })) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  generateSchema(input: Record<string, unknown>) {
    const record = input.record as string;

    let p = createProgram();
    p = spGet(p, 'record', record, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { schema: (existing.data as string) || '' };
        }),
      (b) => complete(b, 'notfound', { message: 'not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const contentStorageHandler = autoInterpret(_contentStorageHandler);

