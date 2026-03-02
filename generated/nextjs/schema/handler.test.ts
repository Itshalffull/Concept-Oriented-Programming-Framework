// Schema — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { schemaHandler } from './handler.js';
import type { SchemaStorage } from './types.js';

const createTestStorage = (): SchemaStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
};

const createFailingStorage = (): SchemaStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = schemaHandler;

describe('Schema handler', () => {
  describe('defineSchema', () => {
    it('should define a new schema', async () => {
      const storage = createTestStorage();
      const result = await handler.defineSchema(
        { schema: 'User', fields: JSON.stringify(['name', 'email']) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists when schema already defined', async () => {
      const storage = createTestStorage();
      await handler.defineSchema({ schema: 'User', fields: JSON.stringify(['name']) }, storage)();
      const result = await handler.defineSchema({ schema: 'User', fields: JSON.stringify(['email']) }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.defineSchema({ schema: 'X', fields: '[]' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('addField', () => {
    it('should add a field to an existing schema', async () => {
      const storage = createTestStorage();
      await handler.defineSchema({ schema: 'User', fields: JSON.stringify(['name']) }, storage)();
      const result = await handler.addField({ schema: 'User', field: 'email' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for non-existent schema', async () => {
      const storage = createTestStorage();
      const result = await handler.addField({ schema: 'Missing', field: 'x' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('extendSchema', () => {
    it('should set parent on child schema', async () => {
      const storage = createTestStorage();
      await handler.defineSchema({ schema: 'Base', fields: JSON.stringify(['id']) }, storage)();
      await handler.defineSchema({ schema: 'Child', fields: JSON.stringify(['extra']) }, storage)();
      const result = await handler.extendSchema({ schema: 'Child', parent: 'Base' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when parent does not exist', async () => {
      const storage = createTestStorage();
      await handler.defineSchema({ schema: 'Child', fields: '[]' }, storage)();
      const result = await handler.extendSchema({ schema: 'Child', parent: 'NonExistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return notfound when child does not exist', async () => {
      const storage = createTestStorage();
      await handler.defineSchema({ schema: 'Base', fields: '[]' }, storage)();
      const result = await handler.extendSchema({ schema: 'Missing', parent: 'Base' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('applyTo', () => {
    it('should apply schema to entity', async () => {
      const storage = createTestStorage();
      await handler.defineSchema({ schema: 'User', fields: JSON.stringify(['name']) }, storage)();
      const result = await handler.applyTo({ entity: 'user-123', schema: 'User' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when schema does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.applyTo({ entity: 'user-1', schema: 'Missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('removeFrom', () => {
    it('should remove association', async () => {
      const storage = createTestStorage();
      await handler.defineSchema({ schema: 'User', fields: '[]' }, storage)();
      await handler.applyTo({ entity: 'user-1', schema: 'User' }, storage)();
      const result = await handler.removeFrom({ entity: 'user-1', schema: 'User' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when association does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.removeFrom({ entity: 'user-1', schema: 'User' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('getAssociations', () => {
    it('should return associations for a schema', async () => {
      const storage = createTestStorage();
      await handler.defineSchema({ schema: 'User', fields: '[]' }, storage)();
      await handler.applyTo({ entity: 'user-1', schema: 'User' }, storage)();
      const result = await handler.getAssociations({ schema: 'User' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for non-existent schema', async () => {
      const storage = createTestStorage();
      const result = await handler.getAssociations({ schema: 'Missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('export', () => {
    it('should export schema with resolved fields', async () => {
      const storage = createTestStorage();
      await handler.defineSchema({ schema: 'Base', fields: JSON.stringify(['id']) }, storage)();
      await handler.defineSchema({ schema: 'User', fields: JSON.stringify(['name', 'email']) }, storage)();
      await handler.extendSchema({ schema: 'User', parent: 'Base' }, storage)();
      const result = await handler.export({ schema: 'User' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const exported = JSON.parse(result.right.data);
          expect(exported.fields).toContain('name');
          expect(exported.fields).toContain('id');
        }
      }
    });

    it('should return notfound for non-existent schema', async () => {
      const storage = createTestStorage();
      const result = await handler.export({ schema: 'Missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
