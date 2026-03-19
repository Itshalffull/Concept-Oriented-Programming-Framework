// @migrated dsl-constructs 2026-03-18
// ============================================================
// PerformanceProfile Handler
//
// Aggregate performance data per static entity -- connecting
// slow operations to their declared structure for optimization.
// Supports timing breakdown for syncs (when/where/then phases),
// selection pipeline (classify/resolve/spawn/connect/render),
// and widget rendering (render count, unnecessary renders,
// mount/unmount timing).
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `performance-profile-${++idCounter}`;
}

/**
 * Compute percentile from a sorted array of numbers.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

const _handler: FunctionalConceptHandler = {
  aggregate(input: Record<string, unknown>) {
    const symbol = input.symbol as string;
    const window = input.window as string;

    let start = '';
    let end = '';
    try {
      const parsed = JSON.parse(window);
      start = parsed.start || '';
      end = parsed.end || '';
    } catch {
      // empty window means all time
    }

    let p = createProgram();
    p = find(p, 'runtime-coverage', { symbol }, 'entries');

    return completeFrom(p, 'ok', (bindings) => {
      const entries = bindings.entries as Record<string, unknown>[];
      const filtered = entries.filter((e) => {
        if (!start && !end) return true;
        const ts = e.timestamp as string || e.lastExercised as string || '';
        if (start && ts < start) return false;
        if (end && ts > end) return false;
        return true;
      });

      if (filtered.length < 2) {
        return { variant: 'insufficientData', count: filtered.length };
      }

      const id = nextId();

      let entityKind = 'unknown';
      if (symbol.includes('/action/')) entityKind = 'action';
      else if (symbol.includes('/sync/')) entityKind = 'sync';
      else if (symbol.includes('/widget/')) entityKind = 'widget';
      else if (symbol.includes('/variant/')) entityKind = 'variant';

      const timings: number[] = [];
      let errorCount = 0;
      for (const e of filtered) {
        const duration = (e.durationMs as number) || 0;
        timings.push(duration);
        if (e.status === 'error' || e.status === 'failed') errorCount++;
      }

      timings.sort((a, b) => a - b);
      const timing = JSON.stringify({
        p50: percentile(timings, 50),
        p90: percentile(timings, 90),
        p99: percentile(timings, 99),
        min: timings[0] || 0,
        max: timings[timings.length - 1] || 0,
      });

      const errorRate = filtered.length > 0
        ? (errorCount / filtered.length).toFixed(4)
        : '0';

      return { profile: id };
    }) as StorageProgram<Result>;
  },

  hotspots(input: Record<string, unknown>) {
    const kind = input.kind as string;
    const metric = input.metric as string;
    const topN = input.topN as number;

    let p = createProgram();
    p = find(p, 'performance-profile', {}, 'allProfiles');

    return completeFrom(p, 'ok', (bindings) => {
      const allProfiles = bindings.allProfiles as Record<string, unknown>[];
      const filtered = kind
        ? allProfiles.filter((pr) => pr.entityKind === kind)
        : allProfiles;

      const scored = filtered.map((pr) => {
        let value = 0;
        if (metric === 'errorRate') {
          value = parseFloat(pr.errorRate as string || '0');
        } else {
          try {
            const timing = JSON.parse(pr.timing as string || '{}');
            value = timing[metric] || 0;
          } catch {
            value = 0;
          }
        }
        return { symbol: pr.entitySymbol as string, value };
      });

      scored.sort((a, b) => b.value - a.value);
      const hotspots = scored.slice(0, topN || 10);

      return { hotspots: JSON.stringify(hotspots) };
    }) as StorageProgram<Result>;
  },

  slowChains(input: Record<string, unknown>) {
    const thresholdMs = input.thresholdMs as number;

    let p = createProgram();
    p = find(p, 'sync-entity', {}, 'allSyncs');
    p = find(p, 'performance-profile', {}, 'allProfiles');

    return completeFrom(p, 'ok', (bindings) => {
      const allSyncs = bindings.allSyncs as Record<string, unknown>[];
      const allProfiles = bindings.allProfiles as Record<string, unknown>[];

      const profileMap = new Map<string, number>();
      for (const pr of allProfiles) {
        try {
          const timing = JSON.parse(pr.timing as string || '{}');
          profileMap.set(pr.entitySymbol as string, timing.p90 || 0);
        } catch {
          // skip
        }
      }

      const chains: Array<Record<string, unknown>> = [];
      for (const sync of allSyncs) {
        const syncSymbol = sync.symbol as string;
        const p90 = profileMap.get(syncSymbol) || 0;

        let totalP90 = p90;
        let bottleneck = syncSymbol;
        let maxP90 = p90;

        try {
          const thenActions = JSON.parse(sync.thenActions as string || '[]');
          for (const action of thenActions) {
            const actionSymbol = `clef/action/${(action as Record<string, unknown>).concept}/${(action as Record<string, unknown>).action}`;
            const actionP90 = profileMap.get(actionSymbol) || 0;
            totalP90 += actionP90;
            if (actionP90 > maxP90) {
              maxP90 = actionP90;
              bottleneck = actionSymbol;
            }
          }
        } catch {
          // skip
        }

        if (totalP90 > thresholdMs) {
          chains.push({
            flowGraphPath: syncSymbol,
            p90TotalMs: totalP90,
            bottleneck,
          });
        }
      }

      chains.sort((a, b) => (b.p90TotalMs as number) - (a.p90TotalMs as number));

      return { chains: JSON.stringify(chains) };
    }) as StorageProgram<Result>;
  },

  compareWindows(input: Record<string, unknown>) {
    const symbol = input.symbol as string;
    const windowA = input.windowA as string;
    const windowB = input.windowB as string;

    let p = createProgram();
    p = find(p, 'performance-profile', { entitySymbol: symbol }, 'profiles');

    return completeFrom(p, 'ok', (bindings) => {
      const profiles = bindings.profiles as Record<string, unknown>[];

      let dataA: Record<string, unknown> | null = null;
      let dataB: Record<string, unknown> | null = null;

      for (const pr of profiles) {
        if (pr.sampleWindow === windowA && !dataA) { dataA = pr; }
        if (pr.sampleWindow === windowB && !dataB) { dataB = pr; }
      }

      if (!dataA) {
        return { variant: 'insufficientData', window: windowA, count: 0 };
      }
      if (!dataB) {
        return { variant: 'insufficientData', window: windowB, count: 0 };
      }

      let aP50 = 0, aP99 = 0, bP50 = 0, bP99 = 0;
      try {
        const timingA = JSON.parse(dataA.timing as string || '{}');
        const timingB = JSON.parse(dataB.timing as string || '{}');
        aP50 = timingA.p50 || 0;
        aP99 = timingA.p99 || 0;
        bP50 = timingB.p50 || 0;
        bP99 = timingB.p99 || 0;
      } catch {
        // defaults
      }

      const pctChange = aP50 > 0 ? ((bP50 - aP50) / aP50 * 100).toFixed(2) : '0';
      const regression = bP50 > aP50 * 1.1;

      return {
        comparison: JSON.stringify({
          aP50, bP50, aP99, bP99, regression, pctChange,
        }),
      };
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const profile = input.profile as string;

    let p = createProgram();
    p = get(p, 'performance-profile', profile, 'record');

    return branch(p,
      (bindings) => !bindings.record,
      (bp) => complete(bp, 'notfound', {}),
      (bp) => completeFrom(bp, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          profile: record.id as string,
          entitySymbol: record.entitySymbol as string,
          entityKind: record.entityKind as string,
          invocationCount: (record.invocationCount as number) || 0,
          errorRate: record.errorRate as string,
        };
      }),
    ) as StorageProgram<Result>;
  },
};

export const performanceProfileHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetPerformanceProfileCounter(): void {
  idCounter = 0;
}
