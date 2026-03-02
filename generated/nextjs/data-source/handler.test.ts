// DataSource — handler.test.ts
// Unit tests for dataSource handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { dataSourceHandler } from './handler.js';
import type { DataSourceStorage } from './types.js';

const createTestStorage = (): DataSourceStorage => {
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

const createFailingStorage = (): DataSourceStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DataSource handler', () => {
  describe('register', () => {
    it('returns ok with sourceId for a new source', async () => {
      const storage = createTestStorage();
      const result = await dataSourceHandler.register(
        { name: 'my-db', uri: 'https://db.example.com', credentials: 'secret' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.sourceId).toBeTruthy();
        }
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dataSourceHandler.register(
        { name: 'my-db', uri: 'https://db.example.com', credentials: 'secret' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('connect', () => {
    it('returns ok when source exists and URI is valid', async () => {
      const storage = createTestStorage();
      await dataSourceHandler.register(
        { name: 'my-db', uri: 'https://db.example.com', credentials: 'secret' },
        storage,
      )();
      const result = await dataSourceHandler.connect(
        { sourceId: 'src-my-db' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound when source does not exist', async () => {
      const storage = createTestStorage();
      const result = await dataSourceHandler.connect(
        { sourceId: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dataSourceHandler.connect(
        { sourceId: 'src-my-db' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('discover', () => {
    it('returns notfound when source does not exist', async () => {
      const storage = createTestStorage();
      const result = await dataSourceHandler.discover(
        { sourceId: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns error when source is not connected', async () => {
      const storage = createTestStorage();
      await dataSourceHandler.register(
        { name: 'my-db', uri: 'https://db.example.com', credentials: 'secret' },
        storage,
      )();
      const result = await dataSourceHandler.discover(
        { sourceId: 'src-my-db' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dataSourceHandler.discover(
        { sourceId: 'src-my-db' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('healthCheck', () => {
    it('returns ok with status when source exists', async () => {
      const storage = createTestStorage();
      await dataSourceHandler.register(
        { name: 'my-db', uri: 'https://db.example.com', credentials: 'secret' },
        storage,
      )();
      const result = await dataSourceHandler.healthCheck(
        { sourceId: 'src-my-db' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound when source does not exist', async () => {
      const storage = createTestStorage();
      const result = await dataSourceHandler.healthCheck(
        { sourceId: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dataSourceHandler.healthCheck(
        { sourceId: 'src-my-db' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('deactivate', () => {
    it('returns ok when source exists', async () => {
      const storage = createTestStorage();
      await dataSourceHandler.register(
        { name: 'my-db', uri: 'https://db.example.com', credentials: 'secret' },
        storage,
      )();
      const result = await dataSourceHandler.deactivate(
        { sourceId: 'src-my-db' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound when source does not exist', async () => {
      const storage = createTestStorage();
      const result = await dataSourceHandler.deactivate(
        { sourceId: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dataSourceHandler.deactivate(
        { sourceId: 'src-my-db' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
