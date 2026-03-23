// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Collection Concept Implementation
// Organize content into queryable sets: concrete (manually curated) or virtual (computed from a query).
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import type { ConceptStorage } from '../../../runtime/types.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _collectionHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    if (!input.collection || (typeof input.collection === 'string' && (input.collection as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'collection is required' }) as StorageProgram<Result>;
    }
    if (!input.type || (typeof input.type === 'string' && (input.type as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'type is required' }) as StorageProgram<Result>;
    }
    if (!input.schema || (typeof input.schema === 'string' && (input.schema as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'schema is required' }) as StorageProgram<Result>;
    }
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
        let b2 = putFrom(b, 'collection', collection, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          let members: string[] = [];
          try {
            members = JSON.parse(existing.members as string || '[]');
          } catch { /* empty */ }
          members.push(member);
          return { ...existing, members: JSON.stringify(members), updatedAt: new Date().toISOString() };
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
      (b) => completeFrom(b, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        let members: string[] = [];
        try {
          members = JSON.parse(existing.members as string || '[]');
        } catch { /* empty */ }
        return { members: members.join(',') };
      }),
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

