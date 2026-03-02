// GenerationPlan — handler.test.ts
// Unit tests for generationPlan handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { generationPlanHandler } from './handler.js';
import type { GenerationPlanStorage } from './types.js';

const createTestStorage = (): GenerationPlanStorage => {
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

const createFailingStorage = (): GenerationPlanStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('GenerationPlan handler', () => {
  describe('begin', () => {
    it('should start a new generation run', async () => {
      const storage = createTestStorage();
      const result = await generationPlanHandler.begin({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.run).toContain('run::');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await generationPlanHandler.begin({}, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('recordStep', () => {
    it('should record a step outcome', async () => {
      const storage = createTestStorage();
      const result = await generationPlanHandler.recordStep(
        { stepKey: 'parse', status: 'ok', filesProduced: O.some(5), duration: O.some(120), cached: false },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should use defaults for optional fields', async () => {
      const storage = createTestStorage();
      const result = await generationPlanHandler.recordStep(
        { stepKey: 'gen', status: 'ok', filesProduced: O.none, duration: O.none, cached: true },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await generationPlanHandler.recordStep(
        { stepKey: 's', status: 'ok', filesProduced: O.none, duration: O.none, cached: false },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('complete', () => {
    it('should complete the current run', async () => {
      const storage = createTestStorage();
      await generationPlanHandler.begin({}, storage)();
      const result = await generationPlanHandler.complete({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.run).toContain('run::');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await generationPlanHandler.complete({}, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('status', () => {
    it('should return recorded steps', async () => {
      const storage = createTestStorage();
      await generationPlanHandler.recordStep(
        { stepKey: 'parse', status: 'ok', filesProduced: O.some(3), duration: O.some(50), cached: false },
        storage,
      )();
      await generationPlanHandler.recordStep(
        { stepKey: 'gen', status: 'ok', filesProduced: O.some(10), duration: O.some(200), cached: true },
        storage,
      )();
      const result = await generationPlanHandler.status({ run: 'any' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.steps.length).toBe(2);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await generationPlanHandler.status({ run: 'r' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('summary', () => {
    it('should aggregate step data into a summary', async () => {
      const storage = createTestStorage();
      await generationPlanHandler.recordStep(
        { stepKey: 'a', status: 'ok', filesProduced: O.some(5), duration: O.some(100), cached: false },
        storage,
      )();
      await generationPlanHandler.recordStep(
        { stepKey: 'b', status: 'failed', filesProduced: O.some(0), duration: O.some(50), cached: false },
        storage,
      )();
      await generationPlanHandler.recordStep(
        { stepKey: 'c', status: 'ok', filesProduced: O.some(3), duration: O.some(0), cached: true },
        storage,
      )();
      const result = await generationPlanHandler.summary({ run: 'r' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.total).toBe(3);
        expect(result.right.cached).toBe(1);
        expect(result.right.failed).toBe(1);
        expect(result.right.executed).toBe(2);
        expect(result.right.filesProduced).toBe(8);
        expect(result.right.totalDuration).toBe(150);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await generationPlanHandler.summary({ run: 'r' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('history', () => {
    it('should return all runs', async () => {
      const storage = createTestStorage();
      await generationPlanHandler.begin({}, storage)();
      await generationPlanHandler.complete({}, storage)();
      await generationPlanHandler.begin({}, storage)();
      const result = await generationPlanHandler.history({ limit: O.some(10) }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.runs.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should respect limit option', async () => {
      const storage = createTestStorage();
      await generationPlanHandler.begin({}, storage)();
      await generationPlanHandler.begin({}, storage)();
      await generationPlanHandler.begin({}, storage)();
      const result = await generationPlanHandler.history({ limit: O.some(1) }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.runs.length).toBe(1);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await generationPlanHandler.history({ limit: O.none }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
