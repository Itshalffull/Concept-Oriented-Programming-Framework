// PySdkTarget — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { pySdkTargetHandler } from './handler.js';
import type { PySdkTargetStorage } from './types.js';

const createTestStorage = (): PySdkTargetStorage => {
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

const createFailingStorage = (): PySdkTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = pySdkTargetHandler;

describe('PySdkTarget handler', () => {
  describe('generate', () => {
    it('should generate a Python SDK package from a JSON projection', async () => {
      const storage = createTestStorage();
      const projection = {
        concept: 'Article',
        actions: ['create', 'get', 'list'],
        fields: [
          { name: 'title', type: 'string' },
          { name: 'viewCount', type: 'number' },
        ],
      };
      const result = await handler.generate(
        { projection: JSON.stringify(projection), config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.package).toBe('article_client');
        expect(result.right.files).toContain('article_client/__init__.py');
        expect(result.right.files).toContain('article_client/client.py');
        expect(result.right.files).toContain('article_client/models.py');
        expect(result.right.files).toContain('pyproject.toml');
      }
    });

    it('should use default actions when projection is a plain string', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { projection: 'widget', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.package).toBe('widget_client');
        expect(result.right.files.length).toBeGreaterThan(0);
      }
    });

    it('should store method metadata in storage', async () => {
      const storage = createTestStorage();
      const projection = {
        concept: 'User',
        actions: ['signUp', 'logIn'],
        fields: [],
      };
      await handler.generate(
        { projection: JSON.stringify(projection), config: '{}' },
        storage,
      )();

      const signUp = await storage.get('methods', 'user_client.sign_up');
      expect(signUp).not.toBeNull();
      if (signUp) {
        expect(signUp.methodName).toBe('sign_up');
        expect(signUp.isAsync).toBe(true);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.generate(
        { projection: 'test', config: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
