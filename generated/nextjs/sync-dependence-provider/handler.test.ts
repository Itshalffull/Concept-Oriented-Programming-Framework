// SyncDependenceProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { syncDependenceProviderHandler } from './handler.js';
import type { SyncDependenceProviderStorage } from './types.js';

const createTestStorage = (): SyncDependenceProviderStorage => {
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

const createFailingStorage = (): SyncDependenceProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = syncDependenceProviderHandler;

const syncSpec = JSON.stringify({
  name: 'user-sync',
  bindings: [
    { source: 'User', target: 'Profile' },
  ],
  triggers: ['User'],
  guards: ['AuthGuard'],
  transforms: [
    { source: 'User', target: 'Notification' },
  ],
});

describe('SyncDependenceProvider handler', () => {
  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('sdp-');
        }
      }
    });

    it('should recover from storage failure with loadError', async () => {
      const storage = createFailingStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('loadError');
      }
    });
  });

  describe('addSyncSpec', () => {
    it('should extract dependency edges from spec', async () => {
      const storage = createTestStorage();
      const result = await handler.addSyncSpec(
        { specBody: syncSpec },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.edgesAdded).toBeGreaterThan(0);
        expect(result.right.conceptsFound).toBeGreaterThan(0);
      }
    });

    it('should handle invalid JSON gracefully', async () => {
      const storage = createTestStorage();
      const result = await handler.addSyncSpec(
        { specBody: 'not json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.edgesAdded).toBe(0);
      }
    });

    it('should return zero edges for spec without name', async () => {
      const storage = createTestStorage();
      const result = await handler.addSyncSpec(
        { specBody: JSON.stringify({ bindings: [{ source: 'A', target: 'B' }] }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.edgesAdded).toBe(0);
      }
    });
  });

  describe('getDependencies', () => {
    it('should return direct dependencies', async () => {
      const storage = createTestStorage();
      await handler.addSyncSpec({ specBody: syncSpec }, storage)();
      const result = await handler.getDependencies(
        { concept: 'User' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.dependencies.length).toBeGreaterThan(0);
      }
    });

    it('should return empty list for unknown concept', async () => {
      const storage = createTestStorage();
      const result = await handler.getDependencies(
        { concept: 'unknown' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.dependencies.length).toBe(0);
      }
    });
  });

  describe('getTransitiveDependencies', () => {
    it('should return transitive dependencies', async () => {
      const storage = createTestStorage();
      await handler.addSyncSpec({ specBody: syncSpec }, storage)();
      const result = await handler.getTransitiveDependencies(
        { concept: 'User' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.dependencies.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getSyncRulesForConcept', () => {
    it('should return sync rules referencing a concept', async () => {
      const storage = createTestStorage();
      await handler.addSyncSpec({ specBody: syncSpec }, storage)();
      const result = await handler.getSyncRulesForConcept(
        { concept: 'User' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.syncNames).toContain('user-sync');
      }
    });

    it('should return empty for unrelated concept', async () => {
      const storage = createTestStorage();
      await handler.addSyncSpec({ specBody: syncSpec }, storage)();
      const result = await handler.getSyncRulesForConcept(
        { concept: 'unrelated' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.syncNames.length).toBe(0);
      }
    });
  });
});
