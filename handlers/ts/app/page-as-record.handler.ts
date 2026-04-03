// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// PageAsRecord Handler — dedicated concept bridging ContentNode to structured record pages.
// Provides fromContentNode action to promote a ContentNode to a typed-field page record.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _pageAsRecordHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    if (!input.page || (typeof input.page === 'string' && (input.page as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'page is required' }) as StorageProgram<Result>;
    }
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
        let b2 = putFrom(b, 'page', page, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const properties = JSON.parse((existing.properties as string) || '{}') as Record<string, unknown>;
          properties[key] = value;
          return { ...existing, properties: JSON.stringify(properties), updatedAt: new Date().toISOString() };
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
      (b) => completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const properties = JSON.parse((existing.properties as string) || '{}') as Record<string, unknown>;
          return { value: (properties[key] as string) ?? '' };
        }),
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

  fromContentNode(input: Record<string, unknown>) {
    const page = input.page as string;
    const nodeId = input.nodeId as string;
    const schema = input.schema as string;

    if (!nodeId || (nodeId as string).trim() === '') {
      return complete(createProgram(), 'error', { message: 'nodeId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'page', page, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'page', page, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, nodeId, schema, updatedAt: new Date().toISOString() };
        });
        return complete(b2, 'ok', { page });
      },
      (b) => complete(b, 'notfound', { message: 'Page not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getNodeId(input: Record<string, unknown>) {
    const page = input.page as string;

    let p = createProgram();
    p = spGet(p, 'page', page, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        return { nodeId: (existing.nodeId as string) ?? null };
      }),
      (b) => complete(b, 'notfound', { message: 'Page not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const pageAsRecordHandler = autoInterpret(_pageAsRecordHandler);

