// @clef-handler style=functional
// ============================================================
// PerformanceProfile Concept Implementation (Functional)
//
// Aggregate performance data per static entity — connecting
// slow operations to their declared structure. Independent
// concept — timing data ingested via syncs from runtime bridge.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, get, find, put, branch, complete, completeFrom, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const performanceProfileHandler: FunctionalConceptHandler = {

  aggregate(input) {
    if (!input.symbol || (typeof input.symbol === 'string' && (input.symbol as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'symbol is required' }) as StorageProgram<Result>;
    }
    const symbol = input.symbol as string;
    const window = input.window as string;
    const id = crypto.randomUUID();
    const key = `profile:${symbol}`;

    // Check for existing timing data
    let p = createProgram();
    p = get(p, 'profile', key, 'existing');

    return branch(p,
      (b) => b.existing != null,
      completeFrom(createProgram(), 'ok', (b) => ({
        profile: (b.existing as Record<string, unknown>).id,
      })),
      // Create new profile — actual timing data ingested via syncs
      complete(
        put(createProgram(), 'profile', key, {
          id,
          entitySymbol: symbol,
          entityKind: '',
          sampleWindow: window || '{}',
          invocationCount: 0,
          timing: JSON.stringify({ p50: 0, p90: 0, p99: 0, mean: 0, max: 0 }),
          errorRate: '0',
          syncBreakdown: '{}',
          selectionBreakdown: '{}',
          renderBreakdown: '{}',
        }),
        'ok', { profile: id },
      ),
    );
  },

  hotspots(input) {
    if (!input.metric || (typeof input.metric === 'string' && (input.metric as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'metric is required' }) as StorageProgram<Result>;
    }
    const kind = input.kind as string;
    const metric = input.metric as string;
    const topN = (input.topN as number) || 10;

    let p = createProgram();
    p = find(p, 'profile', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const ofKind = all.filter(pr => !kind || pr.entityKind === kind);

      const sorted = ofKind
        .map(pr => {
          const timing = JSON.parse(pr.timing as string || '{}');
          let value = 0;
          if (metric === 'errorRate') value = parseFloat(pr.errorRate as string || '0');
          else value = timing[metric] || timing.p90 || 0;
          return { symbol: pr.entitySymbol, value };
        })
        .sort((a, c) => c.value - a.value)
        .slice(0, topN);

      return JSON.stringify(sorted);
    }, 'hotspots');

    return completeFrom(p, 'ok', (b) => ({ hotspots: b.hotspots }));
  },

  slowChains(input) {
    const rawThreshold = Number(input.thresholdMs);
    if (!rawThreshold || rawThreshold <= 0) {
      return complete(createProgram(), 'error', { message: 'thresholdMs must be positive' }) as StorageProgram<Result>;
    }
    const thresholdMs = rawThreshold;

    let p = createProgram();
    p = find(p, 'profile', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const chains = all
        .filter(pr => {
          const timing = JSON.parse(pr.timing as string || '{}');
          return (timing.p90 || 0) > thresholdMs;
        })
        .map(pr => {
          const timing = JSON.parse(pr.timing as string || '{}');
          return {
            flowGraphPath: [pr.entitySymbol],
            p90TotalMs: timing.p90 || 0,
            bottleneck: pr.entitySymbol,
          };
        });
      return JSON.stringify(chains);
    }, 'chains');

    return completeFrom(p, 'ok', (b) => ({ chains: b.chains }));
  },

  compareWindows(input) {
    if (!input.symbol || (typeof input.symbol === 'string' && (input.symbol as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'symbol is required' }) as StorageProgram<Result>;
    }
    const symbol = input.symbol as string;
    const windowA = input.windowA as string;
    const windowB = input.windowB as string;

    let p = createProgram();
    p = get(p, 'profile', `profile:${symbol}`, 'profile');

    return branch(p,
      (b) => b.profile != null,
      completeFrom(createProgram(), 'ok', (b) => {
        const pr = b.profile as Record<string, unknown>;
        const timing = JSON.parse(pr.timing as string || '{}');
        return {
          comparison: JSON.stringify({
            aP50: timing.p50 || 0, bP50: timing.p50 || 0,
            aP99: timing.p99 || 0, bP99: timing.p99 || 0,
            regression: false, pctChange: 0,
          }),
        };
      }),
      complete(createProgram(), 'insufficientData', { window: windowA, count: 0 }),
    );
  },

  get(input) {
    const profile = input.profile as string;

    let p = createProgram();
    p = find(p, 'profile', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.find(pr => pr.id === profile) || null;
    }, 'entry');

    return branch(p,
      (b) => b.entry != null,
      completeFrom(createProgram(), 'ok', (b) => {
        const e = b.entry as Record<string, unknown>;
        return {
          profile: e.id, entitySymbol: e.entitySymbol,
          entityKind: e.entityKind, invocationCount: e.invocationCount,
          errorRate: e.errorRate,
        };
      }),
      complete(createProgram(), 'notfound', {}),
    );
  },
};
