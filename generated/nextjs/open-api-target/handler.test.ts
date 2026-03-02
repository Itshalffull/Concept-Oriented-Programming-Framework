// OpenApiTarget — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { openApiTargetHandler } from './handler.js';
import type { OpenApiTargetStorage } from './types.js';

const createTestStorage = (): OpenApiTargetStorage => {
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

const createFailingStorage = (): OpenApiTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('OpenApiTarget handler', () => {
  describe('generate', () => {
    it('should generate an OpenAPI 3.0 spec from projections', async () => {
      const storage = createTestStorage();

      const result = await openApiTargetHandler.generate(
        { projections: ['User', 'Post'], config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const parsed = JSON.parse(result.right.content);
        expect(parsed.openapi).toBe('3.0.3');
        expect(parsed.paths['/api/user']).toBeDefined();
        expect(parsed.paths['/api/post']).toBeDefined();
      }
    });

    it('should use config values for title and version', async () => {
      const storage = createTestStorage();
      const config = JSON.stringify({
        title: 'My API',
        version: '2.0.0',
        description: 'Custom description',
      });

      const result = await openApiTargetHandler.generate(
        { projections: ['Widget'], config },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const parsed = JSON.parse(result.right.content);
        expect(parsed.info.title).toBe('My API');
        expect(parsed.info.version).toBe('2.0.0');
        expect(parsed.info.description).toBe('Custom description');
      }
    });

    it('should generate component schemas for each projection', async () => {
      const storage = createTestStorage();

      const result = await openApiTargetHandler.generate(
        { projections: ['Order'], config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const parsed = JSON.parse(result.right.content);
        expect(parsed.components.schemas['OrderInput']).toBeDefined();
        expect(parsed.components.schemas['OrderResponse']).toBeDefined();
      }
    });

    it('should persist the generated spec to storage', async () => {
      const storage = createTestStorage();

      const result = await openApiTargetHandler.generate(
        { projections: ['Item'], config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const stored = await storage.get('specs', result.right.spec);
        expect(stored).not.toBeNull();
      }
    });

    it('should handle invalid config JSON gracefully', async () => {
      const storage = createTestStorage();

      const result = await openApiTargetHandler.generate(
        { projections: ['Data'], config: 'not json' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await openApiTargetHandler.generate(
        { projections: ['Fail'], config: '{}' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
