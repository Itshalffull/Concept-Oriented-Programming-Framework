// ============================================================
// PerformanceProfile Handler Tests
//
// Tests for performance-profile: aggregation from runtime
// coverage data, hotspot queries, slow chain detection,
// window comparison, and retrieval.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  performanceProfileHandler,
  resetPerformanceProfileCounter,
} from '../handlers/ts/performance-profile.handler.js';

describe('PerformanceProfile Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetPerformanceProfileCounter();
  });

  /** Helper to seed runtime-coverage entries with timing data */
  async function seedCoverageEntries(
    symbol: string,
    entries: Array<{ durationMs: number; status?: string; timestamp?: string }>,
  ) {
    for (let i = 0; i < entries.length; i++) {
      await storage.put('runtime-coverage', `rc-${symbol}-${i}`, {
        id: `rc-${symbol}-${i}`,
        symbol,
        entitySymbol: symbol,
        durationMs: entries[i].durationMs,
        status: entries[i].status || 'ok',
        timestamp: entries[i].timestamp || new Date().toISOString(),
        lastExercised: entries[i].timestamp || new Date().toISOString(),
      });
    }
  }

  // ----------------------------------------------------------
  // aggregate
  // ----------------------------------------------------------

  describe('aggregate', () => {
    it('aggregates timing data from runtime-coverage entries', async () => {
      await seedCoverageEntries('clef/action/Todo/create', [
        { durationMs: 10 },
        { durationMs: 20 },
        { durationMs: 50 },
        { durationMs: 100 },
      ]);

      const result = await performanceProfileHandler.aggregate(
        { symbol: 'clef/action/Todo/create', window: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.profile).toBe('performance-profile-1');

      const record = await storage.get('performance-profile', result.profile as string);
      expect(record!.entityKind).toBe('action');
      expect(record!.invocationCount).toBe(4);

      const timing = JSON.parse(record!.timing as string);
      expect(timing.min).toBe(10);
      expect(timing.max).toBe(100);
      expect(timing.p50).toBeGreaterThanOrEqual(10);
      expect(timing.p90).toBeGreaterThanOrEqual(timing.p50);
    });

    it('returns insufficientData when fewer than 2 entries', async () => {
      await seedCoverageEntries('clef/action/Todo/create', [{ durationMs: 10 }]);

      const result = await performanceProfileHandler.aggregate(
        { symbol: 'clef/action/Todo/create', window: '{}' },
        storage,
      );
      expect(result.variant).toBe('insufficientData');
      expect(result.count).toBe(1);
    });

    it('computes error rate from entries with error status', async () => {
      await seedCoverageEntries('clef/sync/mySync', [
        { durationMs: 10, status: 'ok' },
        { durationMs: 20, status: 'error' },
        { durationMs: 30, status: 'ok' },
        { durationMs: 40, status: 'failed' },
      ]);

      const result = await performanceProfileHandler.aggregate(
        { symbol: 'clef/sync/mySync', window: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');

      const record = await storage.get('performance-profile', result.profile as string);
      const errorRate = parseFloat(record!.errorRate as string);
      expect(errorRate).toBe(0.5);
    });

    it('identifies entity kind from symbol path', async () => {
      await seedCoverageEntries('clef/widget/Button', [
        { durationMs: 5 },
        { durationMs: 15 },
      ]);

      const result = await performanceProfileHandler.aggregate(
        { symbol: 'clef/widget/Button', window: '{}' },
        storage,
      );
      const record = await storage.get('performance-profile', result.profile as string);
      expect(record!.entityKind).toBe('widget');
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns profile details after aggregation', async () => {
      await seedCoverageEntries('clef/action/Todo/create', [
        { durationMs: 10 },
        { durationMs: 20 },
      ]);

      const agg = await performanceProfileHandler.aggregate(
        { symbol: 'clef/action/Todo/create', window: '{}' },
        storage,
      );
      const result = await performanceProfileHandler.get({ profile: agg.profile }, storage);
      expect(result.variant).toBe('ok');
      expect(result.entitySymbol).toBe('clef/action/Todo/create');
      expect(result.entityKind).toBe('action');
      expect(result.invocationCount).toBe(2);
    });

    it('returns notfound for nonexistent profile', async () => {
      const result = await performanceProfileHandler.get({ profile: 'nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // hotspots
  // ----------------------------------------------------------

  describe('hotspots', () => {
    it('returns hotspots sorted by requested metric', async () => {
      // Seed two profiles manually
      await storage.put('performance-profile', 'pp-1', {
        id: 'pp-1',
        entitySymbol: 'clef/action/Todo/create',
        entityKind: 'action',
        timing: JSON.stringify({ p50: 50, p90: 80, p99: 100 }),
        errorRate: '0.1',
      });
      await storage.put('performance-profile', 'pp-2', {
        id: 'pp-2',
        entitySymbol: 'clef/action/Todo/delete',
        entityKind: 'action',
        timing: JSON.stringify({ p50: 200, p90: 300, p99: 400 }),
        errorRate: '0.05',
      });

      const result = await performanceProfileHandler.hotspots(
        { kind: 'action', metric: 'p90', topN: 10 },
        storage,
      );
      expect(result.variant).toBe('ok');
      const hotspots = JSON.parse(result.hotspots as string);
      expect(hotspots).toHaveLength(2);
      expect(hotspots[0].symbol).toBe('clef/action/Todo/delete');
      expect(hotspots[0].value).toBe(300);
    });

    it('supports errorRate metric', async () => {
      await storage.put('performance-profile', 'pp-1', {
        id: 'pp-1',
        entitySymbol: 'clef/sync/A',
        entityKind: 'sync',
        timing: '{}',
        errorRate: '0.5',
      });
      await storage.put('performance-profile', 'pp-2', {
        id: 'pp-2',
        entitySymbol: 'clef/sync/B',
        entityKind: 'sync',
        timing: '{}',
        errorRate: '0.1',
      });

      const result = await performanceProfileHandler.hotspots(
        { kind: 'sync', metric: 'errorRate', topN: 10 },
        storage,
      );
      const hotspots = JSON.parse(result.hotspots as string);
      expect(hotspots[0].symbol).toBe('clef/sync/A');
      expect(hotspots[0].value).toBe(0.5);
    });

    it('filters by kind', async () => {
      await storage.put('performance-profile', 'pp-1', {
        id: 'pp-1',
        entitySymbol: 'clef/action/A',
        entityKind: 'action',
        timing: JSON.stringify({ p90: 100 }),
        errorRate: '0',
      });
      await storage.put('performance-profile', 'pp-2', {
        id: 'pp-2',
        entitySymbol: 'clef/widget/B',
        entityKind: 'widget',
        timing: JSON.stringify({ p90: 200 }),
        errorRate: '0',
      });

      const result = await performanceProfileHandler.hotspots(
        { kind: 'widget', metric: 'p90', topN: 10 },
        storage,
      );
      const hotspots = JSON.parse(result.hotspots as string);
      expect(hotspots).toHaveLength(1);
      expect(hotspots[0].symbol).toBe('clef/widget/B');
    });
  });

  // ----------------------------------------------------------
  // slowChains
  // ----------------------------------------------------------

  describe('slowChains', () => {
    it('identifies sync chains exceeding the threshold', async () => {
      await storage.put('sync-entity', 'sync-1', {
        id: 'sync-1',
        name: 'slowSync',
        symbol: 'clef/sync/slowSync',
        thenActions: JSON.stringify([{ concept: 'Todo', action: 'create' }]),
      });

      await storage.put('performance-profile', 'pp-1', {
        id: 'pp-1',
        entitySymbol: 'clef/sync/slowSync',
        timing: JSON.stringify({ p90: 500 }),
      });
      await storage.put('performance-profile', 'pp-2', {
        id: 'pp-2',
        entitySymbol: 'clef/action/Todo/create',
        timing: JSON.stringify({ p90: 300 }),
      });

      const result = await performanceProfileHandler.slowChains({ thresholdMs: 100 }, storage);
      expect(result.variant).toBe('ok');
      const chains = JSON.parse(result.chains as string);
      expect(chains).toHaveLength(1);
      expect(chains[0].p90TotalMs).toBe(800);
    });

    it('returns empty when no chains exceed threshold', async () => {
      await storage.put('sync-entity', 'sync-1', {
        id: 'sync-1',
        name: 'fastSync',
        symbol: 'clef/sync/fastSync',
        thenActions: '[]',
      });
      await storage.put('performance-profile', 'pp-1', {
        id: 'pp-1',
        entitySymbol: 'clef/sync/fastSync',
        timing: JSON.stringify({ p90: 5 }),
      });

      const result = await performanceProfileHandler.slowChains({ thresholdMs: 100 }, storage);
      const chains = JSON.parse(result.chains as string);
      expect(chains).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // compareWindows
  // ----------------------------------------------------------

  describe('compareWindows', () => {
    it('compares performance between two time windows', async () => {
      await storage.put('performance-profile', 'pp-1', {
        id: 'pp-1',
        entitySymbol: 'clef/action/Todo/create',
        sampleWindow: '{"start":"2024-01-01","end":"2024-01-07"}',
        timing: JSON.stringify({ p50: 50, p99: 100 }),
      });
      await storage.put('performance-profile', 'pp-2', {
        id: 'pp-2',
        entitySymbol: 'clef/action/Todo/create',
        sampleWindow: '{"start":"2024-01-08","end":"2024-01-14"}',
        timing: JSON.stringify({ p50: 70, p99: 150 }),
      });

      const result = await performanceProfileHandler.compareWindows(
        {
          symbol: 'clef/action/Todo/create',
          windowA: '{"start":"2024-01-01","end":"2024-01-07"}',
          windowB: '{"start":"2024-01-08","end":"2024-01-14"}',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      const comparison = JSON.parse(result.comparison as string);
      expect(comparison.aP50).toBe(50);
      expect(comparison.bP50).toBe(70);
      expect(comparison.regression).toBe(true);
    });

    it('returns insufficientData when window A profile not found', async () => {
      const result = await performanceProfileHandler.compareWindows(
        { symbol: 'clef/action/X', windowA: 'a', windowB: 'b' },
        storage,
      );
      expect(result.variant).toBe('insufficientData');
    });
  });
});
