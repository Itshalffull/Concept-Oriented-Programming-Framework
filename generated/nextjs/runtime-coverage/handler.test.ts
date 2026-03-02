// RuntimeCoverage — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { runtimeCoverageHandler } from './handler.js';
import type { RuntimeCoverageStorage } from './types.js';

const createTestStorage = (): RuntimeCoverageStorage => {
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

const createFailingStorage = (): RuntimeCoverageStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = runtimeCoverageHandler;

describe('RuntimeCoverage handler', () => {
  describe('record', () => {
    it('should create a new coverage entry', async () => {
      const storage = createTestStorage();
      const result = await handler.record(
        { symbol: 'Order.create', kind: 'action', flowId: 'flow-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('created');
      }
    });

    it('should increment hit count for existing entry', async () => {
      const storage = createTestStorage();
      await handler.record({ symbol: 'Order.create', kind: 'action', flowId: 'flow-1' }, storage)();
      const result = await handler.record({ symbol: 'Order.create', kind: 'action', flowId: 'flow-2' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.record({ symbol: 'X', kind: 'action', flowId: 'f' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('coverageReport', () => {
    it('should return a coverage report', async () => {
      const storage = createTestStorage();
      await handler.record({ symbol: 'A.x', kind: 'action', flowId: 'f1' }, storage)();
      const result = await handler.coverageReport({ kind: 'action', since: '2026-01-01' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const report = JSON.parse(result.right.report);
        expect(report.kind).toBe('action');
        expect(report.coveredSymbols).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('variantCoverage', () => {
    it('should return variant coverage report', async () => {
      const storage = createTestStorage();
      const result = await handler.variantCoverage({ concept: 'Order' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('syncCoverage', () => {
    it('should return sync coverage report', async () => {
      const storage = createTestStorage();
      const result = await handler.syncCoverage({ since: '2026-01-01' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('widgetStateCoverage', () => {
    it('should return widget state coverage', async () => {
      const storage = createTestStorage();
      const result = await handler.widgetStateCoverage({ widget: 'OrderCard' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('widgetLifecycleReport', () => {
    it('should return lifecycle report', async () => {
      const storage = createTestStorage();
      const result = await handler.widgetLifecycleReport({ widget: 'OrderCard', since: '2026-01-01' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('widgetRenderTrace', () => {
    it('should return notfound when no render traces exist', async () => {
      const storage = createTestStorage();
      const result = await handler.widgetRenderTrace({ widgetInstance: 'inst-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return renders when traces exist', async () => {
      const storage = createTestStorage();
      await storage.put('render_trace', 'trace-1', {
        widgetInstance: 'inst-1', renderIndex: 0, durationMs: 10, stateSnapshot: '{}',
      });
      const result = await handler.widgetRenderTrace({ widgetInstance: 'inst-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('widgetComparison', () => {
    it('should return ranking', async () => {
      const storage = createTestStorage();
      const result = await handler.widgetComparison({ since: '2026-01-01', topN: 5 }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('deadAtRuntime', () => {
    it('should return empty when no registered symbols', async () => {
      const storage = createTestStorage();
      const result = await handler.deadAtRuntime({ kind: 'action' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const dead = JSON.parse(result.right.neverExercised);
        expect(dead).toEqual([]);
      }
    });

    it('should identify never-exercised symbols', async () => {
      const storage = createTestStorage();
      await storage.put('registered_symbol', 'sym-1', { symbol: 'Order.create', name: 'Order.create', kind: 'action' });
      await storage.put('registered_symbol', 'sym-2', { symbol: 'Order.delete', name: 'Order.delete', kind: 'action' });
      await handler.record({ symbol: 'Order.create', kind: 'action', flowId: 'f1' }, storage)();
      const result = await handler.deadAtRuntime({ kind: 'action' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const dead = JSON.parse(result.right.neverExercised);
        expect(dead).toContain('Order.delete');
      }
    });
  });
});
