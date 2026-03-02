// TreeSitterQueryProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { treeSitterQueryProviderHandler } from './handler.js';
import type { TreeSitterQueryProviderStorage } from './types.js';

const createTestStorage = (): TreeSitterQueryProviderStorage => {
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

const createFailingStorage = (): TreeSitterQueryProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = treeSitterQueryProviderHandler;

describe('TreeSitterQueryProvider handler', () => {
  describe('initialize', () => {
    it('should initialize and return an instance id', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.instance).toContain('query-provider-');
      }
    });

    it('should persist provider metadata to storage', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const instanceId = result.right.instance;
        const provider = await storage.get('query_providers', instanceId);
        expect(provider).not.toBeNull();
        expect(provider?.maxPatternDepth).toBe(32);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });

  describe('execute', () => {
    it('should execute a valid pattern against a tree', async () => {
      const storage = createTestStorage();
      const tree = '(program (function_declaration name: (identifier)))';
      const result = await handler.execute(
        { pattern: '(function_declaration)', tree },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const matches = JSON.parse(result.right.matches);
          expect(Array.isArray(matches)).toBe(true);
          expect(matches.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return invalidPattern for empty pattern', async () => {
      const storage = createTestStorage();
      const result = await handler.execute(
        { pattern: '', tree: '(program)' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidPattern');
      }
    });

    it('should return invalidPattern for unbalanced parentheses', async () => {
      const storage = createTestStorage();
      const result = await handler.execute(
        { pattern: '(function_declaration', tree: '(program)' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidPattern');
      }
    });

    it('should return invalidPattern for unmatched closing paren', async () => {
      const storage = createTestStorage();
      const result = await handler.execute(
        { pattern: 'function_declaration)', tree: '(program)' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidPattern');
      }
    });

    it('should handle captures in patterns', async () => {
      const storage = createTestStorage();
      const tree = '(program (class_declaration name: (identifier)))';
      const result = await handler.execute(
        { pattern: '(class_declaration @name)', tree },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const matches = JSON.parse(result.right.matches);
          expect(matches.length).toBeGreaterThan(0);
          expect(matches[0].captures).toBeDefined();
        }
      }
    });

    it('should return empty matches for non-matching pattern', async () => {
      const storage = createTestStorage();
      const tree = '(program (variable_declaration))';
      const result = await handler.execute(
        { pattern: '(class_declaration)', tree },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const matches = JSON.parse(result.right.matches);
          expect(matches.length).toBe(0);
        }
      }
    });

    it('should return left on storage failure during execution', async () => {
      const storage = createFailingStorage();
      const result = await handler.execute(
        { pattern: '(identifier)', tree: '(program (identifier))' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
