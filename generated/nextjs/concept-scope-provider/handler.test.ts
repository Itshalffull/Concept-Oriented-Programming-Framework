// ConceptScopeProvider — handler.test.ts
// Unit tests for conceptScopeProvider handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { conceptScopeProviderHandler } from './handler.js';
import type { ConceptScopeProviderStorage } from './types.js';

const handler = conceptScopeProviderHandler;

const createTestStorage = (): ConceptScopeProviderStorage => {
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

const createFailingStorage = (): ConceptScopeProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ConceptScopeProvider handler', () => {
  describe('initialize', () => {
    it('should initialize and return an instance id', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('csp-');
        }
      }
    });

    it('should return loadError on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('loadError');
      }
    });
  });

  describe('registerScope', () => {
    it('should register a scope with entries from a spec body', async () => {
      const storage = createTestStorage();
      const specBody = JSON.stringify({
        state: { title: { type: 'string' }, count: { type: 'number' } },
        actions: ['create', 'delete'],
        types: ['ArticleType'],
        events: ['onPublish'],
      });
      const result = await handler.registerScope(
        { conceptName: 'Article', specBody, parentScope: null },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.entryCount).toBe(6);
      }
    });

    it('should handle invalid JSON spec body gracefully', async () => {
      const storage = createTestStorage();
      const result = await handler.registerScope(
        { conceptName: 'Empty', specBody: 'not-json', parentScope: null },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.entryCount).toBe(0);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.registerScope(
        { conceptName: 'Article', specBody: '{}', parentScope: null },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resolve', () => {
    it('should resolve a name within a registered scope', async () => {
      const storage = createTestStorage();
      const specBody = JSON.stringify({
        state: { title: { type: 'string' } },
        actions: ['create'],
      });
      await handler.registerScope(
        { conceptName: 'Article', specBody, parentScope: null },
        storage,
      )();
      const result = await handler.resolve(
        { name: 'title', scopeId: 'Article' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.found).toBe(true);
        expect(result.right.entry).not.toBeNull();
      }
    });

    it('should return found=false for an unknown name', async () => {
      const storage = createTestStorage();
      await handler.registerScope(
        { conceptName: 'Article', specBody: '{}', parentScope: null },
        storage,
      )();
      const result = await handler.resolve(
        { name: 'nonexistent', scopeId: 'Article' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.found).toBe(false);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.resolve(
        { name: 'title', scopeId: 'Article' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('visibleEntries', () => {
    it('should return all visible entries from a scope', async () => {
      const storage = createTestStorage();
      const specBody = JSON.stringify({
        state: { title: { type: 'string' } },
        actions: ['create'],
      });
      await handler.registerScope(
        { conceptName: 'Article', specBody, parentScope: null },
        storage,
      )();
      const result = await handler.visibleEntries(
        { scopeId: 'Article' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.entries.length).toBe(2);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.visibleEntries(
        { scopeId: 'Article' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
