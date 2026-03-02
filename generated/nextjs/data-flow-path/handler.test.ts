// DataFlowPath — handler.test.ts
// Unit tests for dataFlowPath handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { dataFlowPathHandler } from './handler.js';
import type { DataFlowPathStorage } from './types.js';

const createTestStorage = (): DataFlowPathStorage => {
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

const createFailingStorage = (): DataFlowPathStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DataFlowPath handler', () => {
  describe('trace', () => {
    it('returns noPath when no edges exist', async () => {
      const storage = createTestStorage();
      const result = await dataFlowPathHandler.trace(
        { source: 'A', sink: 'B' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noPath');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dataFlowPathHandler.trace(
        { source: 'A', sink: 'B' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('traceFromConfig', () => {
    it('returns ok with empty results when no edges exist', async () => {
      const storage = createTestStorage();
      const result = await dataFlowPathHandler.traceFromConfig(
        { configKey: 'config/db-url' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dataFlowPathHandler.traceFromConfig(
        { configKey: 'config/db-url' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('traceToOutput', () => {
    it('returns ok with empty results when no edges exist', async () => {
      const storage = createTestStorage();
      const result = await dataFlowPathHandler.traceToOutput(
        { output: 'output-gen' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dataFlowPathHandler.traceToOutput(
        { output: 'output-gen' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('returns notfound when path does not exist', async () => {
      const storage = createTestStorage();
      const result = await dataFlowPathHandler.get(
        { path: 'missing-path' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dataFlowPathHandler.get(
        { path: 'test-path' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
