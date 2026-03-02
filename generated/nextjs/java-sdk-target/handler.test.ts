// JavaSdkTarget — handler.test.ts
// Unit tests for javaSdkTarget handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { javaSdkTargetHandler } from './handler.js';
import type { JavaSdkTargetStorage } from './types.js';

const createTestStorage = (): JavaSdkTargetStorage => {
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

const createFailingStorage = (): JavaSdkTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('JavaSdkTarget handler', () => {
  describe('generate', () => {
    it('should generate Java SDK files from a JSON projection', async () => {
      const storage = createTestStorage();
      const input = {
        projection: JSON.stringify({
          concept: 'user',
          actions: ['create', 'get', 'list'],
          fields: [
            { name: 'id', type: 'string' },
            { name: 'age', type: 'number' },
          ],
        }),
        config: '{}',
      };

      const result = await javaSdkTargetHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.artifact).toContain('user');
        expect(result.right.files).toContain('pom.xml');
        expect(result.right.files.length).toBeGreaterThanOrEqual(4);
      }
    });

    it('should generate from a plain string projection with defaults', async () => {
      const storage = createTestStorage();
      const input = { projection: 'order', config: '{}' };

      const result = await javaSdkTargetHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.artifact).toContain('order');
        expect(result.right.files).toContain('pom.xml');
      }
    });

    it('should use custom groupId from projection', async () => {
      const storage = createTestStorage();
      const input = {
        projection: JSON.stringify({
          concept: 'billing',
          groupId: 'com.example.billing',
        }),
        config: '{}',
      };

      const result = await javaSdkTargetHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        // File paths should reflect the custom group ID
        const hasCustomPath = result.right.files.some(
          (f) => f.includes('com/example/billing'),
        );
        expect(hasCustomPath).toBe(true);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = { projection: 'test', config: '{}' };
      const result = await javaSdkTargetHandler.generate(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
