// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _contentStorageHandler: FunctionalConceptHandler = {
  save(input: Record<string, unknown>) {
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
      (b) => complete(b, 'ok', { record, data: '' }),
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
    const filter = input.filter as string;

    let p = createProgram();
    p = find(p, 'record', filter as unknown as Record<string, unknown>, 'results');
    return complete(p, 'ok', { results: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  generateSchema(input: Record<string, unknown>) {
    const record = input.record as string;

    let p = createProgram();
    p = spGet(p, 'record', record, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { schema: '' }),
      (b) => complete(b, 'notfound', { message: 'not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const contentStorageHandler = autoInterpret(_contentStorageHandler);

