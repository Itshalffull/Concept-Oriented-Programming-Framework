// SlotSource — handler.test.ts
// Unit tests for slot source register, resolve, and process actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { slotSourceHandler } from './handler.js';
import type { SlotSourceStorage } from './types.js';

const createTestStorage = (): SlotSourceStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation, filter?) => {
      const all = [...(store.get(relation)?.values() ?? [])];
      if (!filter) return all;
      return all.filter((record) =>
        Object.entries(filter).every(([k, v]) => record[k] === v),
      );
    },
  };
};

const createFailingStorage = (): SlotSourceStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('SlotSource handler', () => {
  describe('register', () => {
    it('registers a new source type with ok variant', async () => {
      const storage = createTestStorage();
      const result = await slotSourceHandler.register(
        { source_type: 'static_value', provider: 'built-in' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns already_registered for duplicate source type', async () => {
      const storage = createTestStorage();
      await slotSourceHandler.register(
        { source_type: 'static_value', provider: 'built-in' },
        storage,
      )();
      const result = await slotSourceHandler.register(
        { source_type: 'static_value', provider: 'another' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('already_registered');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await slotSourceHandler.register(
        { source_type: 'static_value', provider: 'built-in' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resolve', () => {
    it('resolves a static_value source with ok variant', async () => {
      const storage = createTestStorage();
      await slotSourceHandler.register(
        { source_type: 'static_value', provider: 'built-in' },
        storage,
      )();

      const result = await slotSourceHandler.resolve(
        {
          source_type: 'static_value',
          config: '{"value":"Hello World"}',
          context: '{}',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).data).toBe('Hello World');
      }
    });

    it('returns error for unregistered source type', async () => {
      const storage = createTestStorage();
      const result = await slotSourceHandler.resolve(
        {
          source_type: 'unknown',
          config: '{}',
          context: '{}',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns error for invalid config JSON', async () => {
      const storage = createTestStorage();
      await slotSourceHandler.register(
        { source_type: 'entity_field', provider: 'built-in' },
        storage,
      )();

      const result = await slotSourceHandler.resolve(
        {
          source_type: 'entity_field',
          config: 'invalid-json',
          context: '{}',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('resolves entity_field source type', async () => {
      const storage = createTestStorage();
      await slotSourceHandler.register(
        { source_type: 'entity_field', provider: 'built-in' },
        storage,
      )();

      const result = await slotSourceHandler.resolve(
        {
          source_type: 'entity_field',
          config: '{"field":"title"}',
          context: '{"entity_id":"task-1"}',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const data = JSON.parse((result.right as any).data);
        expect(data.field).toBe('title');
        expect(data.entity_id).toBe('task-1');
      }
    });
  });

  describe('process', () => {
    it('processes data with truncate processor', async () => {
      const storage = createTestStorage();
      const longText = 'A'.repeat(200);
      const result = await slotSourceHandler.process(
        { data: longText, processors: ['truncate'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).result.length).toBeLessThan(200);
      }
    });

    it('processes data with strip_html processor', async () => {
      const storage = createTestStorage();
      const result = await slotSourceHandler.process(
        { data: '<b>Hello</b> <i>World</i>', processors: ['strip_html'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).result).toBe('Hello World');
      }
    });

    it('processes data with fallback for empty value', async () => {
      const storage = createTestStorage();
      const result = await slotSourceHandler.process(
        { data: '', processors: ['fallback'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).result).toBe('(no value)');
      }
    });
  });

  describe('multi-step sequence: register -> resolve -> process', () => {
    it('completes full data retrieval pipeline', async () => {
      const storage = createTestStorage();

      await slotSourceHandler.register(
        { source_type: 'static_value', provider: 'built-in' },
        storage,
      )();

      const resolveResult = await slotSourceHandler.resolve(
        {
          source_type: 'static_value',
          config: '{"value":"<b>Important</b>"}',
          context: '{}',
        },
        storage,
      )();
      expect(E.isRight(resolveResult)).toBe(true);
      const data = (resolveResult as any).right.data;

      const processResult = await slotSourceHandler.process(
        { data, processors: ['strip_html'] },
        storage,
      )();
      expect(E.isRight(processResult)).toBe(true);
      if (E.isRight(processResult)) {
        expect((processResult.right as any).result).toBe('Important');
      }
    });
  });

  describe('storage failure', () => {
    it('propagates storage errors on resolve', async () => {
      const storage = createFailingStorage();
      const result = await slotSourceHandler.resolve(
        { source_type: 'static_value', config: '{}', context: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
