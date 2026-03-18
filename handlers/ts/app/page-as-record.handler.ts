// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const pageAsRecordHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const page = input.page as string;
    const schema = input.schema as string;

    let p = createProgram();
    p = spGet(p, 'page', page, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'already exists' }),
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'page', page, {
          page,
          schema,
          properties: JSON.stringify({}),
          body: '',
          createdAt: now,
          updatedAt: now,
        });
        return complete(b2, 'ok', { page });
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setProperty(input: Record<string, unknown>) {
    const page = input.page as string;
    const key = input.key as string;
    const value = input.value as string;

    let p = createProgram();
    p = spGet(p, 'page', page, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'page', page, {
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { page });
      },
      (b) => complete(b, 'notfound', { message: 'Page not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getProperty(input: Record<string, unknown>) {
    const page = input.page as string;
    const key = input.key as string;

    let p = createProgram();
    p = spGet(p, 'page', page, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { value: '' }),
      (b) => complete(b, 'notfound', { message: 'Page not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  appendToBody(input: Record<string, unknown>) {
    const page = input.page as string;
    const content = input.content as string;

    let p = createProgram();
    p = spGet(p, 'page', page, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'page', page, {
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { page });
      },
      (b) => complete(b, 'notfound', { message: 'Page not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  attachToSchema(input: Record<string, unknown>) {
    const page = input.page as string;
    const schema = input.schema as string;

    let p = createProgram();
    p = spGet(p, 'page', page, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'page', page, {
          schema,
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { page });
      },
      (b) => complete(b, 'notfound', { message: 'Page not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  convertFromFreeform(input: Record<string, unknown>) {
    const page = input.page as string;
    const schema = input.schema as string;

    let p = createProgram();
    p = spGet(p, 'page', page, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'page', page, {
          schema,
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { page });
      },
      (b) => complete(b, 'notfound', { message: 'Page not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
