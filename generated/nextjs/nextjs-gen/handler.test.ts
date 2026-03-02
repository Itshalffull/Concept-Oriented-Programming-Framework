// NextjsGen — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { nextjsGenHandler } from './handler.js';
import type { NextjsGenStorage } from './types.js';

const createTestStorage = (): NextjsGenStorage => {
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

const createFailingStorage = (): NextjsGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('NextjsGen handler', () => {
  describe('generate', () => {
    it('should generate files from a valid manifest with operations', async () => {
      const storage = createTestStorage();
      const manifest = {
        name: 'user',
        operations: [
          {
            name: 'create',
            input: [{ name: 'email', type: 'string' }, { name: 'age', type: 'number' }],
            output: [
              { variant: 'ok', fields: [{ name: 'id', type: 'string' }] },
              { variant: 'error', fields: [{ name: 'message', type: 'string' }] },
            ],
          },
        ],
      };

      const result = await nextjsGenHandler.generate(
        { spec: 'user.spec', manifest },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.files.length).toBeGreaterThan(0);
          const paths = result.right.files.map((f) => f.path);
          expect(paths).toContain('app/api/user/types.ts');
          expect(paths).toContain('app/api/user/create/route.ts');
          expect(paths).toContain('app/api/user/actions.ts');
        }
      }
    });

    it('should return error for invalid manifest (null)', async () => {
      const storage = createTestStorage();

      const result = await nextjsGenHandler.generate(
        { spec: 'test.spec', manifest: null },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for manifest missing name', async () => {
      const storage = createTestStorage();

      const result = await nextjsGenHandler.generate(
        { spec: 'test.spec', manifest: { operations: [] } },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should generate types with correct field type mapping', async () => {
      const storage = createTestStorage();
      const manifest = {
        name: 'item',
        operations: [
          {
            name: 'create',
            input: [
              { name: 'count', type: 'integer' },
              { name: 'active', type: 'boolean' },
              { name: 'label', type: 'string' },
            ],
            output: [{ variant: 'ok', fields: [] }],
          },
        ],
      };

      const result = await nextjsGenHandler.generate(
        { spec: 'item.spec', manifest },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const typesFile = result.right.files.find((f) => f.path.endsWith('types.ts'));
        expect(typesFile).toBeDefined();
        expect(typesFile!.content).toContain('number');
        expect(typesFile!.content).toContain('boolean');
        expect(typesFile!.content).toContain('string');
      }
    });

    it('should persist generation metadata to storage', async () => {
      const storage = createTestStorage();
      const manifest = {
        name: 'widget',
        operations: [],
      };

      const result = await nextjsGenHandler.generate(
        { spec: 'widget.spec', manifest },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      const stored = await storage.get('generated', 'widget.spec');
      expect(stored).not.toBeNull();
      expect(stored!.conceptName).toBe('widget');
    });

    it('should return left on storage failure during persist', async () => {
      const storage = createFailingStorage();
      const manifest = {
        name: 'broken',
        operations: [],
      };

      const result = await nextjsGenHandler.generate(
        { spec: 'broken.spec', manifest },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });
});
