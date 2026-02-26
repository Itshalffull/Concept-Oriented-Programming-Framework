// ============================================================
// RuntimeCoverage Handler Tests
//
// Tests for runtime-coverage: recording coverage events,
// increment-on-duplicate, coverage reports, variant coverage,
// sync coverage, widget state coverage, widget lifecycle
// reporting, widget render tracing, widget comparison, and
// dead-at-runtime detection.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  runtimeCoverageHandler,
  resetRuntimeCoverageCounter,
} from '../handlers/ts/runtime-coverage.handler.js';

describe('RuntimeCoverage Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetRuntimeCoverageCounter();
  });

  // ----------------------------------------------------------
  // record
  // ----------------------------------------------------------

  describe('record', () => {
    it('creates a new coverage entry on first record', async () => {
      const result = await runtimeCoverageHandler.record(
        { symbol: 'clef/action/Todo/create', kind: 'action', flowId: 'flow-1' },
        storage,
      );
      expect(result.variant).toBe('created');
      expect(result.entry).toBe('runtime-coverage-1');
    });

    it('increments execution count on subsequent records', async () => {
      await runtimeCoverageHandler.record(
        { symbol: 'clef/action/Todo/create', kind: 'action', flowId: 'flow-1' },
        storage,
      );
      const second = await runtimeCoverageHandler.record(
        { symbol: 'clef/action/Todo/create', kind: 'action', flowId: 'flow-2' },
        storage,
      );
      expect(second.variant).toBe('ok');

      const record = await storage.get('runtime-coverage', second.entry as string);
      expect(record!.executionCount).toBe(2);
      const flowIds = JSON.parse(record!.flowIds as string);
      expect(flowIds).toContain('flow-1');
      expect(flowIds).toContain('flow-2');
    });

    it('stores entityKind and symbol correctly', async () => {
      const result = await runtimeCoverageHandler.record(
        { symbol: 'clef/sync/mySync', kind: 'sync', flowId: 'flow-1' },
        storage,
      );
      const record = await storage.get('runtime-coverage', result.entry as string);
      expect(record!.entityKind).toBe('sync');
      expect(record!.symbol).toBe('clef/sync/mySync');
      expect(record!.entitySymbol).toBe('clef/sync/mySync');
      expect(record!.executionCount).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // coverageReport
  // ----------------------------------------------------------

  describe('coverageReport', () => {
    it('computes coverage percentage against registered entities', async () => {
      // Seed 3 action entities
      await storage.put('action-entity', 'a1', { id: 'a1', symbol: 'clef/action/Todo/create' });
      await storage.put('action-entity', 'a2', { id: 'a2', symbol: 'clef/action/Todo/delete' });
      await storage.put('action-entity', 'a3', { id: 'a3', symbol: 'clef/action/Todo/get' });

      // Record coverage for 2 of 3
      await runtimeCoverageHandler.record(
        { symbol: 'clef/action/Todo/create', kind: 'action', flowId: 'f1' },
        storage,
      );
      await runtimeCoverageHandler.record(
        { symbol: 'clef/action/Todo/delete', kind: 'action', flowId: 'f2' },
        storage,
      );

      const result = await runtimeCoverageHandler.coverageReport({ kind: 'action', since: '' }, storage);
      expect(result.variant).toBe('ok');
      const report = JSON.parse(result.report as string);
      expect(report.totalEntities).toBe(3);
      expect(report.exercised).toBe(2);
      expect(report.unexercised).toBe(1);
      expect(report.coveragePct).toBeCloseTo(66.67, 1);
    });

    it('returns 0% coverage when no entries recorded', async () => {
      await storage.put('action-entity', 'a1', { id: 'a1', symbol: 'clef/action/Todo/create' });

      const result = await runtimeCoverageHandler.coverageReport({ kind: 'action', since: '' }, storage);
      const report = JSON.parse(result.report as string);
      expect(report.exercised).toBe(0);
      expect(report.coveragePct).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // variantCoverage
  // ----------------------------------------------------------

  describe('variantCoverage', () => {
    it('reports coverage per variant for a concept', async () => {
      // Seed action and variant entities
      await storage.put('action-entity', 'a1', {
        id: 'a1',
        concept: 'Todo',
        name: 'create',
        symbol: 'clef/action/Todo/create',
      });
      await storage.put('variant-entity', 'v1', {
        id: 'v1',
        action: 'Todo/create',
        tag: 'ok',
        symbol: 'clef/variant/Todo/create/ok',
      });
      await storage.put('variant-entity', 'v2', {
        id: 'v2',
        action: 'Todo/create',
        tag: 'error',
        symbol: 'clef/variant/Todo/create/error',
      });

      // Record coverage for the 'ok' variant only
      await runtimeCoverageHandler.record(
        { symbol: 'clef/variant/Todo/create/ok', kind: 'variant', flowId: 'f1' },
        storage,
      );

      const result = await runtimeCoverageHandler.variantCoverage({ concept: 'Todo' }, storage);
      expect(result.variant).toBe('ok');
      const report = JSON.parse(result.report as string);
      expect(report).toHaveLength(2);

      const okEntry = report.find((r: Record<string, unknown>) => r.variant === 'ok');
      const errorEntry = report.find((r: Record<string, unknown>) => r.variant === 'error');
      expect(okEntry.exercised).toBe(true);
      expect(okEntry.count).toBe(1);
      expect(errorEntry.exercised).toBe(false);
      expect(errorEntry.count).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // syncCoverage
  // ----------------------------------------------------------

  describe('syncCoverage', () => {
    it('reports coverage for all syncs', async () => {
      await storage.put('sync-entity', 's1', {
        id: 's1',
        name: 'onTodoCreate',
        symbol: 'clef/sync/onTodoCreate',
        tier: 'critical',
      });
      await storage.put('sync-entity', 's2', {
        id: 's2',
        name: 'onUserSignup',
        symbol: 'clef/sync/onUserSignup',
        tier: 'standard',
      });

      await runtimeCoverageHandler.record(
        { symbol: 'clef/sync/onTodoCreate', kind: 'sync', flowId: 'f1' },
        storage,
      );

      const result = await runtimeCoverageHandler.syncCoverage({ since: '' }, storage);
      expect(result.variant).toBe('ok');
      const report = JSON.parse(result.report as string);
      expect(report).toHaveLength(2);

      const todoSync = report.find((r: Record<string, unknown>) => r.sync === 'onTodoCreate');
      const userSync = report.find((r: Record<string, unknown>) => r.sync === 'onUserSignup');
      expect(todoSync.exercised).toBe(true);
      expect(todoSync.count).toBe(1);
      expect(userSync.exercised).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // widgetStateCoverage
  // ----------------------------------------------------------

  describe('widgetStateCoverage', () => {
    it('reports coverage per widget state', async () => {
      await storage.put('widget-state-entity', 'ws1', {
        id: 'ws1',
        widget: 'Button',
        name: 'idle',
        symbol: 'clef/widget-state/Button/idle',
        transitions: JSON.stringify([{ event: 'click', target: 'pressed' }]),
      });
      await storage.put('widget-state-entity', 'ws2', {
        id: 'ws2',
        widget: 'Button',
        name: 'pressed',
        symbol: 'clef/widget-state/Button/pressed',
        transitions: '[]',
      });

      await runtimeCoverageHandler.record(
        { symbol: 'clef/widget-state/Button/idle', kind: 'widget-state', flowId: 'f1' },
        storage,
      );

      const result = await runtimeCoverageHandler.widgetStateCoverage({ widget: 'Button' }, storage);
      expect(result.variant).toBe('ok');
      const report = JSON.parse(result.report as string);
      expect(report).toHaveLength(2);

      const idleEntry = report.find((r: Record<string, unknown>) => r.state === 'idle');
      const pressedEntry = report.find((r: Record<string, unknown>) => r.state === 'pressed');
      expect(idleEntry.entered).toBe(true);
      expect(pressedEntry.entered).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // widgetLifecycleReport
  // ----------------------------------------------------------

  describe('widgetLifecycleReport', () => {
    it('aggregates lifecycle events for a widget', async () => {
      const widgetSymbol = 'clef/widget/Button';

      // Seed mount/unmount/render entries
      await storage.put('runtime-coverage', 'rc-mount', {
        id: 'rc-mount',
        symbol: `${widgetSymbol}/mount`,
        entityKind: 'widget-mount',
        executionCount: 10,
      });
      await storage.put('runtime-coverage', 'rc-unmount', {
        id: 'rc-unmount',
        symbol: `${widgetSymbol}/unmount`,
        entityKind: 'widget-unmount',
        executionCount: 3,
      });
      await storage.put('runtime-coverage', 'rc-render', {
        id: 'rc-render',
        symbol: `${widgetSymbol}/render`,
        entityKind: 'widget-render',
        executionCount: 50,
      });
      await storage.put('runtime-coverage', 'rc-unnecessary', {
        id: 'rc-unnecessary',
        symbol: `${widgetSymbol}/unnecessary-render`,
        entityKind: 'widget-unnecessary-render',
        executionCount: 5,
      });

      const result = await runtimeCoverageHandler.widgetLifecycleReport(
        { widget: 'Button', since: '' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const report = JSON.parse(result.report as string);
      expect(report.mountCount).toBe(10);
      expect(report.unmountCount).toBe(3);
      expect(report.activeInstances).toBe(7);
      expect(report.renderCount).toBe(50);
      expect(report.unnecessaryRenderPct).toBe(10);
    });

    it('returns zero values when no lifecycle events recorded', async () => {
      const result = await runtimeCoverageHandler.widgetLifecycleReport(
        { widget: 'Empty', since: '' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const report = JSON.parse(result.report as string);
      expect(report.mountCount).toBe(0);
      expect(report.renderCount).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // widgetRenderTrace
  // ----------------------------------------------------------

  describe('widgetRenderTrace', () => {
    it('returns render traces from coverage entries', async () => {
      await storage.put('runtime-coverage', 'rc-render', {
        id: 'rc-render',
        symbol: 'button-instance-1',
        entityKind: 'widget-render',
        flowIds: JSON.stringify(['f1', 'f2']),
        lastExercised: '2024-01-01T00:00:00Z',
      });

      const result = await runtimeCoverageHandler.widgetRenderTrace(
        { widgetInstance: 'button-instance-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const renders = JSON.parse(result.renders as string);
      expect(renders).toHaveLength(2);
      expect(renders[0].flowId).toBe('f1');
    });

    it('returns notfound when no render entries exist', async () => {
      const result = await runtimeCoverageHandler.widgetRenderTrace(
        { widgetInstance: 'nope' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // widgetComparison
  // ----------------------------------------------------------

  describe('widgetComparison', () => {
    it('ranks widgets by total renders', async () => {
      await storage.put('widget-entity', 'w1', { id: 'w1', name: 'Button' });
      await storage.put('widget-entity', 'w2', { id: 'w2', name: 'Card' });

      await storage.put('runtime-coverage', 'rc-btn-render', {
        id: 'rc-btn-render',
        symbol: 'clef/widget/Button/render',
        entityKind: 'widget-render',
        executionCount: 100,
      });
      await storage.put('runtime-coverage', 'rc-card-render', {
        id: 'rc-card-render',
        symbol: 'clef/widget/Card/render',
        entityKind: 'widget-render',
        executionCount: 50,
      });

      const result = await runtimeCoverageHandler.widgetComparison({ since: '', topN: 10 }, storage);
      expect(result.variant).toBe('ok');
      const ranking = JSON.parse(result.ranking as string);
      expect(ranking).toHaveLength(2);
      expect(ranking[0].widget).toBe('Button');
      expect(ranking[0].totalRenders).toBe(100);
    });
  });

  // ----------------------------------------------------------
  // deadAtRuntime
  // ----------------------------------------------------------

  describe('deadAtRuntime', () => {
    it('identifies entities never exercised at runtime', async () => {
      await storage.put('action-entity', 'a1', {
        id: 'a1',
        symbol: 'clef/action/Todo/create',
      });
      await storage.put('action-entity', 'a2', {
        id: 'a2',
        symbol: 'clef/action/Todo/delete',
      });
      await storage.put('action-entity', 'a3', {
        id: 'a3',
        symbol: 'clef/action/Todo/get',
      });

      // Only 'create' has been exercised
      await runtimeCoverageHandler.record(
        { symbol: 'clef/action/Todo/create', kind: 'action', flowId: 'f1' },
        storage,
      );

      const result = await runtimeCoverageHandler.deadAtRuntime({ kind: 'action' }, storage);
      expect(result.variant).toBe('ok');
      const neverExercised = JSON.parse(result.neverExercised as string);
      expect(neverExercised).toHaveLength(2);
      expect(neverExercised).toContain('clef/action/Todo/delete');
      expect(neverExercised).toContain('clef/action/Todo/get');
      expect(neverExercised).not.toContain('clef/action/Todo/create');
    });

    it('returns empty when all entities exercised', async () => {
      await storage.put('action-entity', 'a1', { id: 'a1', symbol: 'clef/action/Todo/create' });

      await runtimeCoverageHandler.record(
        { symbol: 'clef/action/Todo/create', kind: 'action', flowId: 'f1' },
        storage,
      );

      const result = await runtimeCoverageHandler.deadAtRuntime({ kind: 'action' }, storage);
      const neverExercised = JSON.parse(result.neverExercised as string);
      expect(neverExercised).toHaveLength(0);
    });
  });
});
