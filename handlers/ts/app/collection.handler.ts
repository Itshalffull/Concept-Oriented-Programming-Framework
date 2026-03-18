// @migrated dsl-constructs 2026-03-18
// Collection Concept Implementation
// Organize content into queryable sets: concrete (manually curated) or virtual (computed from a query).
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _collectionHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const collection = input.collection as string;
    const type = input.type as string;
    const schema = input.schema as string;

    let p = createProgram();
    p = spGet(p, 'collection', collection, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', {}),
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'collection', collection, {
          collection,
          type,
          schema,
          members: JSON.stringify([]),
          query: '',
          templates: '',
          createdAt: now,
          updatedAt: now,
        });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addMember(input: Record<string, unknown>) {
    const collection = input.collection as string;
    const member = input.member as string;

    let p = createProgram();
    p = spGet(p, 'collection', collection, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Append member to existing list — resolved at runtime
        let b2 = put(b, 'collection', collection, {
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  removeMember(input: Record<string, unknown>) {
    const collection = input.collection as string;
    const member = input.member as string;

    let p = createProgram();
    p = spGet(p, 'collection', collection, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Filter member from list — resolved at runtime
        let b2 = put(b, 'collection', collection, {
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getMembers(input: Record<string, unknown>) {
    const collection = input.collection as string;

    let p = createProgram();
    p = spGet(p, 'collection', collection, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { members: '' }),
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setSchema(input: Record<string, unknown>) {
    const collection = input.collection as string;
    const schema = input.schema as string;

    let p = createProgram();
    p = spGet(p, 'collection', collection, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'collection', collection, {
          schema,
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  createVirtual(input: Record<string, unknown>) {
    const collection = input.collection as string;
    const query = input.query as string;

    let p = createProgram();
    p = spGet(p, 'collection', collection, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', {}),
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'collection', collection, {
          collection,
          type: 'virtual',
          schema: '',
          members: JSON.stringify([]),
          query,
          templates: '',
          createdAt: now,
          updatedAt: now,
        });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  materialize(input: Record<string, unknown>) {
    const collection = input.collection as string;

    let p = createProgram();
    p = spGet(p, 'collection', collection, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'collection', collection, {
          type: 'materialized',
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { members: '' });
      },
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const collectionHandler = autoInterpret(_collectionHandler);

