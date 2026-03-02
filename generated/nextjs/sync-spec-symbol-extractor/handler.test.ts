// SyncSpecSymbolExtractor — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { syncSpecSymbolExtractorHandler } from './handler.js';
import type { SyncSpecSymbolExtractorStorage } from './types.js';

const createTestStorage = (): SyncSpecSymbolExtractorStorage => {
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

const createFailingStorage = (): SyncSpecSymbolExtractorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = syncSpecSymbolExtractorHandler;

const jsonSpec = JSON.stringify({
  name: 'user-sync',
  bindings: [
    { name: 'user-profile', source: 'User', target: 'Profile', sourceField: 'name', targetField: 'displayName' },
  ],
  triggers: ['UserCreated'],
  guards: ['isActive'],
  transforms: ['toDisplayName'],
});

const rawSyncSource = `
sync MySync
trigger User.create
bind user.name -> profile.displayName
guard isActive
`;

describe('SyncSpecSymbolExtractor handler', () => {
  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('ssse-');
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

  describe('extract', () => {
    it('should extract symbols from JSON spec', async () => {
      const storage = createTestStorage();
      const result = await handler.extract(
        { file: 'user.sync', content: jsonSpec },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const kinds = result.right.symbols.map((s) => s.kind);
        expect(kinds).toContain('sync-rule');
        expect(kinds).toContain('binding');
        expect(kinds).toContain('trigger');
        expect(kinds).toContain('guard');
        expect(kinds).toContain('transform');
      }
    });

    it('should extract sync-rule name', async () => {
      const storage = createTestStorage();
      const result = await handler.extract(
        { file: 'user.sync', content: jsonSpec },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const syncRules = result.right.symbols.filter((s) => s.kind === 'sync-rule');
        expect(syncRules.length).toBe(1);
        expect(syncRules[0].name).toBe('user-sync');
      }
    });

    it('should extract concept references from bindings', async () => {
      const storage = createTestStorage();
      const result = await handler.extract(
        { file: 'user.sync', content: jsonSpec },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const conceptRefs = result.right.symbols.filter((s) => s.kind === 'concept-ref');
        const names = conceptRefs.map((s) => s.name);
        expect(names).toContain('User');
        expect(names).toContain('Profile');
      }
    });

    it('should extract field references from bindings', async () => {
      const storage = createTestStorage();
      const result = await handler.extract(
        { file: 'user.sync', content: jsonSpec },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const fieldRefs = result.right.symbols.filter((s) => s.kind === 'field-ref');
        const names = fieldRefs.map((s) => s.name);
        expect(names).toContain('name');
        expect(names).toContain('displayName');
      }
    });

    it('should generate qualified names with sync prefix', async () => {
      const storage = createTestStorage();
      const result = await handler.extract(
        { file: 'user.sync', content: jsonSpec },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const trigger = result.right.symbols.find((s) => s.kind === 'trigger');
        expect(trigger?.qualifiedName).toBe('user-sync.trigger.UserCreated');
      }
    });

    it('should extract symbols from raw .sync file format', async () => {
      const storage = createTestStorage();
      const result = await handler.extract(
        { file: 'my.sync', content: rawSyncSource },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const kinds = result.right.symbols.map((s) => s.kind);
        expect(kinds).toContain('sync-rule');
        expect(kinds).toContain('trigger');
        expect(kinds).toContain('binding');
        expect(kinds).toContain('guard');
      }
    });

    it('should persist extracted symbols to storage', async () => {
      const storage = createTestStorage();
      await handler.extract({ file: 'user.sync', content: jsonSpec }, storage)();
      const stored = await storage.find('sync_symbols');
      expect(stored.length).toBeGreaterThan(0);
    });

    it('should clear previous symbols for the same file on re-extract', async () => {
      const storage = createTestStorage();
      await handler.extract(
        { file: 'user.sync', content: jsonSpec },
        storage,
      )();
      const countBefore = (await storage.find('sync_symbols')).length;
      // Re-extract with different content
      const newSpec = JSON.stringify({ name: 'new-sync', triggers: ['T1'] });
      await handler.extract({ file: 'user.sync', content: newSpec }, storage)();
      const after = await storage.find('sync_symbols');
      // Should have replaced, not accumulated
      expect(after.length).toBeLessThanOrEqual(countBefore);
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.extract(
        { file: 'user.sync', content: jsonSpec },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getSymbolsForFile', () => {
    it('should return symbols for a specific file', async () => {
      const storage = createTestStorage();
      await handler.extract({ file: 'a.sync', content: jsonSpec }, storage)();
      const result = await handler.getSymbolsForFile(
        { file: 'a.sync' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBeGreaterThan(0);
        expect(result.right.symbols.every((s) => s.file === 'a.sync')).toBe(true);
      }
    });

    it('should return empty for unknown file', async () => {
      const storage = createTestStorage();
      const result = await handler.getSymbolsForFile(
        { file: 'unknown.sync' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBe(0);
      }
    });
  });

  describe('findByKind', () => {
    it('should find all symbols of a specific kind', async () => {
      const storage = createTestStorage();
      await handler.extract({ file: 'a.sync', content: jsonSpec }, storage)();
      const result = await handler.findByKind(
        { kind: 'trigger' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBeGreaterThanOrEqual(1);
        expect(result.right.symbols.every((s) => s.kind === 'trigger')).toBe(true);
      }
    });

    it('should return empty for kind with no matches', async () => {
      const storage = createTestStorage();
      const result = await handler.findByKind(
        { kind: 'nonexistent-kind' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBe(0);
      }
    });
  });
});
