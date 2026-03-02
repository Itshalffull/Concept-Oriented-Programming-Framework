// GoSdkTarget — handler.test.ts
// Unit tests for goSdkTarget handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { goSdkTargetHandler } from './handler.js';
import type { GoSdkTargetStorage } from './types.js';

const createTestStorage = (): GoSdkTargetStorage => {
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

const createFailingStorage = (): GoSdkTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('GoSdkTarget handler', () => {
  describe('generate', () => {
    it('should generate a Go module from a JSON projection', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'UserProfile',
        actions: ['create', 'get', 'update', 'delete'],
        fields: [
          { name: 'name', type: 'string' },
          { name: 'age', type: 'integer' },
          { name: 'active', type: 'boolean' },
        ],
      });
      const result = await goSdkTargetHandler.generate(
        { projection, config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.module).toContain('clef-sdk');
        expect(result.right.files).toContain('go.mod');
        expect(result.right.files.some((f) => f.includes('client.go'))).toBe(true);
        expect(result.right.files.some((f) => f.includes('types.go'))).toBe(true);
      }
    });

    it('should handle plain string projection as concept name', async () => {
      const storage = createTestStorage();
      const result = await goSdkTargetHandler.generate(
        { projection: 'Auth', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.module).toContain('auth');
      }
    });

    it('should generate default CRUD actions when none specified', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({ concept: 'Item' });
      const result = await goSdkTargetHandler.generate(
        { projection, config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        // Default actions: create, get, list, update, delete -> 5 methods
        expect(result.right.files.length).toBeGreaterThanOrEqual(4);
      }
    });

    it('should use custom module prefix from projection', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'Order',
        modulePrefix: 'github.com/my-org/sdk',
      });
      const result = await goSdkTargetHandler.generate(
        { projection, config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.module).toContain('github.com/my-org/sdk');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await goSdkTargetHandler.generate(
        { projection: 'Test', config: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
