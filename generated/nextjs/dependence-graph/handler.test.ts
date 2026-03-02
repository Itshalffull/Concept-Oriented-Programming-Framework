// DependenceGraph — handler.test.ts
// Unit tests for dependenceGraph handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { dependenceGraphHandler } from './handler.js';
import type { DependenceGraphStorage } from './types.js';

const createTestStorage = (): DependenceGraphStorage => {
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

const createFailingStorage = (): DependenceGraphStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DependenceGraph handler', () => {
  describe('compute', () => {
    it('returns ok with graph id for supported scope', async () => {
      const storage = createTestStorage();
      const result = await dependenceGraphHandler.compute(
        { scopeRef: 'module:my-module.ts' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.graph).toBeTruthy();
        }
      }
    });

    it('returns unsupportedLanguage for unknown scope ref', async () => {
      const storage = createTestStorage();
      const result = await dependenceGraphHandler.compute(
        { scopeRef: 'unknown-no-extension' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unsupportedLanguage');
      }
    });

    it('returns left on storage failure for supported scope', async () => {
      const storage = createFailingStorage();
      const result = await dependenceGraphHandler.compute(
        { scopeRef: 'module:test.ts' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('queryDependents', () => {
    it('returns ok with dependents list', async () => {
      const storage = createTestStorage();
      const result = await dependenceGraphHandler.queryDependents(
        { symbol: 'MyClass', edgeKinds: '*' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dependenceGraphHandler.queryDependents(
        { symbol: 'MyClass', edgeKinds: '*' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('queryDependencies', () => {
    it('returns ok with dependencies list', async () => {
      const storage = createTestStorage();
      const result = await dependenceGraphHandler.queryDependencies(
        { symbol: 'MyClass', edgeKinds: '*' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dependenceGraphHandler.queryDependencies(
        { symbol: 'MyClass', edgeKinds: '*' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('sliceForward', () => {
    it('returns ok with slice', async () => {
      const storage = createTestStorage();
      const result = await dependenceGraphHandler.sliceForward(
        { criterion: 'myFunc' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dependenceGraphHandler.sliceForward(
        { criterion: 'myFunc' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('sliceBackward', () => {
    it('returns ok with slice', async () => {
      const storage = createTestStorage();
      const result = await dependenceGraphHandler.sliceBackward(
        { criterion: 'myFunc' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dependenceGraphHandler.sliceBackward(
        { criterion: 'myFunc' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('impactAnalysis', () => {
    it('returns ok with affected symbols', async () => {
      const storage = createTestStorage();
      const result = await dependenceGraphHandler.impactAnalysis(
        { changed: JSON.stringify(['symbolA']) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dependenceGraphHandler.impactAnalysis(
        { changed: JSON.stringify(['symbolA']) },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('returns notfound when graph does not exist', async () => {
      const storage = createTestStorage();
      const result = await dependenceGraphHandler.get(
        { graph: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dependenceGraphHandler.get(
        { graph: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
