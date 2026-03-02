// DefinitionUnit — handler.test.ts
// Unit tests for definitionUnit handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { definitionUnitHandler } from './handler.js';
import type { DefinitionUnitStorage } from './types.js';

const createTestStorage = (): DefinitionUnitStorage => {
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

const createFailingStorage = (): DefinitionUnitStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DefinitionUnit handler', () => {
  describe('extract', () => {
    it('returns notADefinition when tree has non-definition node type', async () => {
      const storage = createTestStorage();
      const result = await definitionUnitHandler.extract(
        { tree: 'test-tree', startByte: 0, endByte: 42 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notADefinition');
      }
    });

    it('returns ok when tree record has a definition node type', async () => {
      const storage = createTestStorage();
      await storage.put('tree', 'my-tree', { nodeTypeAt: 'function_declaration' });
      const result = await definitionUnitHandler.extract(
        { tree: 'my-tree', startByte: 0, endByte: 100 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.unit).toBeTruthy();
        }
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await definitionUnitHandler.extract(
        { tree: 'test-tree', startByte: 0, endByte: 42 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findBySymbol', () => {
    it('returns notfound when no matching symbol exists', async () => {
      const storage = createTestStorage();
      const result = await definitionUnitHandler.findBySymbol(
        { symbol: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await definitionUnitHandler.findBySymbol(
        { symbol: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByPattern', () => {
    it('returns ok with units list', async () => {
      const storage = createTestStorage();
      const result = await definitionUnitHandler.findByPattern(
        { kind: 'function_declaration', language: 'typescript', namePattern: '.*Handler' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await definitionUnitHandler.findByPattern(
        { kind: 'function_declaration', language: 'typescript', namePattern: '.*' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('diff', () => {
    it('returns ok with changes when units have different fingerprints', async () => {
      const storage = createTestStorage();
      await storage.put('definition_unit', 'unit-a', {
        id: 'unit-a', fingerprint: 'aaa', nodeType: 'function_declaration', byteLength: 100,
      });
      await storage.put('definition_unit', 'unit-b', {
        id: 'unit-b', fingerprint: 'bbb', nodeType: 'function_declaration', byteLength: 200,
      });
      const result = await definitionUnitHandler.diff(
        { a: 'unit-a', b: 'unit-b' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns same when units have identical fingerprints', async () => {
      const storage = createTestStorage();
      await storage.put('definition_unit', 'unit-a', {
        id: 'unit-a', fingerprint: 'same', nodeType: 'function_declaration', byteLength: 100,
      });
      await storage.put('definition_unit', 'unit-b', {
        id: 'unit-b', fingerprint: 'same', nodeType: 'function_declaration', byteLength: 100,
      });
      const result = await definitionUnitHandler.diff(
        { a: 'unit-a', b: 'unit-b' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('same');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await definitionUnitHandler.diff(
        { a: 'unit-a', b: 'unit-b' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
