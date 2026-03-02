// TestSelection — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { testSelectionHandler } from './handler.js';
import type { TestSelectionStorage } from './types.js';

const createTestStorage = (): TestSelectionStorage => {
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

const createFailingStorage = (): TestSelectionStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('TestSelection handler', () => {
  describe('analyze', () => {
    it('should return noMappings when no mappings exist', async () => {
      const storage = createTestStorage();

      const result = await testSelectionHandler.analyze(
        { changedSources: ['src/auth.ts'], testType: O.none },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noMappings');
      }
    });

    it('should return affected tests when mappings overlap with changed sources', async () => {
      const storage = createTestStorage();
      await storage.put('test_mappings', 'test-auth-ts', {
        testId: 'test-auth',
        language: 'typescript',
        testType: 'unit',
        coveredSources: ['src/auth.ts', 'src/session.ts'],
        duration: 2,
        passed: true,
      });

      const result = await testSelectionHandler.analyze(
        { changedSources: ['src/auth.ts'], testType: O.none },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.affectedTests.length).toBeGreaterThan(0);
          expect(result.right.affectedTests[0].testId).toBe('test-auth');
        }
      }
    });

    it('should filter by testType when specified', async () => {
      const storage = createTestStorage();
      await storage.put('test_mappings', 'unit-1', {
        testId: 'unit-1',
        language: 'typescript',
        testType: 'unit',
        coveredSources: ['src/auth.ts'],
      });
      await storage.put('test_mappings', 'e2e-1', {
        testId: 'e2e-1',
        language: 'typescript',
        testType: 'e2e',
        coveredSources: ['src/auth.ts'],
      });

      const result = await testSelectionHandler.analyze(
        { changedSources: ['src/auth.ts'], testType: O.some('unit') },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.affectedTests.every((t) => t.testType === 'unit')).toBe(true);
        }
      }
    });
  });

  describe('select', () => {
    it('should select all tests when no budget is specified', async () => {
      const storage = createTestStorage();

      const result = await testSelectionHandler.select(
        {
          affectedTests: [
            { testId: 't1', language: 'ts', testType: 'unit', relevance: 1.0 },
            { testId: 't2', language: 'ts', testType: 'unit', relevance: 0.5 },
          ],
          budget: O.none,
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.selected).toHaveLength(2);
          expect(result.right.confidence).toBe(1.0);
        }
      }
    });

    it('should return budgetInsufficient when budget is too small', async () => {
      const storage = createTestStorage();
      await storage.put('test_mappings', 't1-ts', { testId: 't1', duration: 100 });
      await storage.put('test_mappings', 't2-ts', { testId: 't2', duration: 100 });

      const result = await testSelectionHandler.select(
        {
          affectedTests: [
            { testId: 't1', language: 'ts', testType: 'unit', relevance: 1.0 },
            { testId: 't2', language: 'ts', testType: 'unit', relevance: 0.5 },
          ],
          budget: O.some({ maxDuration: 100, maxTests: 1 }),
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('budgetInsufficient');
        if (result.right.variant === 'budgetInsufficient') {
          expect(result.right.missedTests).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('record', () => {
    it('should record a test mapping', async () => {
      const storage = createTestStorage();

      const result = await testSelectionHandler.record(
        {
          testId: 'test-auth',
          language: 'typescript',
          testType: 'unit',
          coveredSources: ['src/auth.ts'],
          duration: 2.5,
          passed: true,
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.mapping).toBe('test-auth-typescript');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await testSelectionHandler.record(
        {
          testId: 'test-1',
          language: 'ts',
          testType: 'unit',
          coveredSources: [],
          duration: 1,
          passed: true,
        },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should return statistics for existing mappings', async () => {
      const storage = createTestStorage();
      await storage.put('test_mappings', 'test-1-ts', { testId: 'test-1', duration: 1 });
      await storage.put('test_mappings', 'test-2-ts', { testId: 'test-2', duration: 2 });

      const result = await testSelectionHandler.statistics({}, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.stats.totalMappings).toBe(2);
      }
    });

    it('should return zero stats when no mappings exist', async () => {
      const storage = createTestStorage();

      const result = await testSelectionHandler.statistics({}, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.stats.totalMappings).toBe(0);
        expect(result.right.stats.avgSelectionRatio).toBe(0);
      }
    });
  });
});
