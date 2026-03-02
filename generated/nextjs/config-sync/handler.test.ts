// ConfigSync — handler.test.ts
// Unit tests for configSync handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { configSyncHandler } from './handler.js';
import type { ConfigSyncStorage } from './types.js';

const handler = configSyncHandler;

const createTestStorage = (): ConfigSyncStorage => {
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

const createFailingStorage = (): ConfigSyncStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

/** Helper to seed a config into storage. */
const seedConfig = async (storage: ConfigSyncStorage, name: string, data: Record<string, unknown>) => {
  await storage.put('configs', name, {
    config: name,
    data: JSON.stringify(data),
    version: 1,
  });
};

describe('ConfigSync handler', () => {
  describe('export', () => {
    it('should export an existing config as JSON', async () => {
      const storage = createTestStorage();
      await seedConfig(storage, 'app-config', { theme: 'dark', lang: 'en' });
      const result = await handler.export({ config: 'app-config' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const exported = JSON.parse(result.right.data);
          expect(exported.data.theme).toBe('dark');
        }
      }
    });

    it('should return notfound when config does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.export({ config: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.export({ config: 'app-config' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('import', () => {
    it('should import valid JSON config data', async () => {
      const storage = createTestStorage();
      const result = await handler.import(
        { config: 'app-config', data: JSON.stringify({ theme: 'light' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return error for invalid JSON data', async () => {
      const storage = createTestStorage();
      const result = await handler.import(
        { config: 'app-config', data: 'not-json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should increment version on re-import', async () => {
      const storage = createTestStorage();
      await handler.import(
        { config: 'app-config', data: JSON.stringify({ v: 1 }) },
        storage,
      )();
      await handler.import(
        { config: 'app-config', data: JSON.stringify({ v: 2 }) },
        storage,
      )();
      const exported = await handler.export({ config: 'app-config' }, storage)();
      expect(E.isRight(exported)).toBe(true);
      if (E.isRight(exported) && exported.right.variant === 'ok') {
        const data = JSON.parse(exported.right.data);
        expect(data.version).toBe(2);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.import(
        { config: 'app-config', data: JSON.stringify({ theme: 'light' }) },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('override', () => {
    it('should apply overrides to an existing config', async () => {
      const storage = createTestStorage();
      await seedConfig(storage, 'app-config', { theme: 'dark' });
      const result = await handler.override(
        { config: 'app-config', layer: 'production', values: JSON.stringify({ debug: false }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when config does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.override(
        { config: 'nonexistent', layer: 'production', values: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.override(
        { config: 'app-config', layer: 'production', values: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('diff', () => {
    it('should compute diff between two existing configs', async () => {
      const storage = createTestStorage();
      await seedConfig(storage, 'config-a', { theme: 'dark', lang: 'en' });
      await seedConfig(storage, 'config-b', { theme: 'light', lang: 'en' });
      const result = await handler.diff(
        { configA: 'config-a', configB: 'config-b' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const changes = JSON.parse(result.right.changes);
          expect(changes.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return notfound when either config does not exist', async () => {
      const storage = createTestStorage();
      await seedConfig(storage, 'config-a', { theme: 'dark' });
      const result = await handler.diff(
        { configA: 'config-a', configB: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.diff(
        { configA: 'a', configB: 'b' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
