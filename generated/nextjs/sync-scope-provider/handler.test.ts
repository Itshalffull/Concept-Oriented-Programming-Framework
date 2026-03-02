// SyncScopeProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { syncScopeProviderHandler } from './handler.js';
import type { SyncScopeProviderStorage } from './types.js';

const createTestStorage = (): SyncScopeProviderStorage => {
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

const createFailingStorage = (): SyncScopeProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = syncScopeProviderHandler;

const syncSpec = JSON.stringify({
  bindings: [
    { name: 'user-profile', source: 'User', target: 'Profile', direction: 'source', sourceField: 'name', targetField: 'displayName' },
  ],
  triggers: ['UserCreated'],
  guards: ['isActive'],
  transforms: ['toDisplayName'],
});

describe('SyncScopeProvider handler', () => {
  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('ssp-');
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

  describe('registerScope', () => {
    it('should register a scope with extracted entries', async () => {
      const storage = createTestStorage();
      const result = await handler.registerScope(
        { syncName: 'user-sync', specBody: syncSpec, parentScope: null },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.entryCount).toBeGreaterThan(0);
      }
    });

    it('should extract bindings, triggers, guards, and transforms', async () => {
      const storage = createTestStorage();
      const result = await handler.registerScope(
        { syncName: 'user-sync', specBody: syncSpec, parentScope: null },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        // binding (1) + field-refs (2) + trigger (1) + guard (1) + transform (1) = 6
        expect(result.right.entryCount).toBeGreaterThanOrEqual(5);
      }
    });

    it('should handle invalid JSON gracefully', async () => {
      const storage = createTestStorage();
      const result = await handler.registerScope(
        { syncName: 'bad-sync', specBody: 'not json', parentScope: null },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.entryCount).toBe(0);
      }
    });
  });

  describe('resolve', () => {
    it('should resolve a name in a registered scope', async () => {
      const storage = createTestStorage();
      await handler.registerScope(
        { syncName: 'user-sync', specBody: syncSpec, parentScope: null },
        storage,
      )();
      const result = await handler.resolve(
        { name: 'user-profile', scopeId: 'user-sync' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.found).toBe(true);
        expect(result.right.entry).not.toBeNull();
        expect(result.right.entry?.kind).toBe('binding');
      }
    });

    it('should resolve names from parent scope', async () => {
      const storage = createTestStorage();
      const parentSpec = JSON.stringify({ triggers: ['ParentTrigger'] });
      await handler.registerScope(
        { syncName: 'parent-sync', specBody: parentSpec, parentScope: null },
        storage,
      )();
      await handler.registerScope(
        { syncName: 'child-sync', specBody: JSON.stringify({}), parentScope: 'parent-sync' },
        storage,
      )();
      const result = await handler.resolve(
        { name: 'ParentTrigger', scopeId: 'child-sync' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.found).toBe(true);
      }
    });

    it('should return not found for unregistered name', async () => {
      const storage = createTestStorage();
      await handler.registerScope(
        { syncName: 'user-sync', specBody: syncSpec, parentScope: null },
        storage,
      )();
      const result = await handler.resolve(
        { name: 'nonexistent', scopeId: 'user-sync' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.found).toBe(false);
        expect(result.right.entry).toBeNull();
      }
    });
  });

  describe('visibleEntries', () => {
    it('should list all entries visible from a scope', async () => {
      const storage = createTestStorage();
      await handler.registerScope(
        { syncName: 'user-sync', specBody: syncSpec, parentScope: null },
        storage,
      )();
      const result = await handler.visibleEntries(
        { scopeId: 'user-sync' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.entries.length).toBeGreaterThan(0);
      }
    });

    it('should include parent scope entries', async () => {
      const storage = createTestStorage();
      const parentSpec = JSON.stringify({ triggers: ['ParentTrigger'] });
      await handler.registerScope(
        { syncName: 'parent-sync', specBody: parentSpec, parentScope: null },
        storage,
      )();
      const childSpec = JSON.stringify({ guards: ['ChildGuard'] });
      await handler.registerScope(
        { syncName: 'child-sync', specBody: childSpec, parentScope: 'parent-sync' },
        storage,
      )();
      const result = await handler.visibleEntries(
        { scopeId: 'child-sync' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const names = result.right.entries.map((e) => e.name);
        expect(names).toContain('ChildGuard');
        expect(names).toContain('ParentTrigger');
      }
    });
  });

  describe('getBindings', () => {
    it('should return only binding entries for a sync', async () => {
      const storage = createTestStorage();
      await handler.registerScope(
        { syncName: 'user-sync', specBody: syncSpec, parentScope: null },
        storage,
      )();
      const result = await handler.getBindings(
        { syncName: 'user-sync' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.bindings.every((b) => b.kind === 'binding')).toBe(true);
        expect(result.right.bindings.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should return empty for unknown sync', async () => {
      const storage = createTestStorage();
      const result = await handler.getBindings(
        { syncName: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.bindings.length).toBe(0);
      }
    });
  });
});
