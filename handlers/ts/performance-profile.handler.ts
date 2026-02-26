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

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

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

export const performanceProfileHandler: ConceptHandler = {
  async aggregate(input: Record<string, unknown>, storage: ConceptStorage) {
    const symbol = input.symbol as string;
    const window = input.window as string;

    // Parse window to get time range
    let start = '';
    let end = '';
    try {
      const parsed = JSON.parse(window);
      start = parsed.start || '';
      end = parsed.end || '';
    } catch {
      // empty window means all time
    }

    // Find runtime coverage entries for this symbol
    const entries = await storage.find('runtime-coverage', { symbol });
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

    // Determine entity kind from symbol path
    let entityKind = 'unknown';
    if (symbol.includes('/action/')) entityKind = 'action';
    else if (symbol.includes('/sync/')) entityKind = 'sync';
    else if (symbol.includes('/widget/')) entityKind = 'widget';
    else if (symbol.includes('/variant/')) entityKind = 'variant';

    // Collect timing data from performance entries
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

    await storage.put('performance-profile', id, {
      id,
      entitySymbol: symbol,
      entityKind,
      sampleWindow: window,
      invocationCount: filtered.length,
      timing,
      errorRate,
      syncBreakdown: '{}',
      selectionBreakdown: '{}',
      renderBreakdown: '{}',
    });

    return { variant: 'ok', profile: id };
  },

  async hotspots(input: Record<string, unknown>, storage: ConceptStorage) {
    const kind = input.kind as string;
    const metric = input.metric as string;
    const topN = input.topN as number;

    const allProfiles = await storage.find('performance-profile');
    const filtered = kind
      ? allProfiles.filter((p) => p.entityKind === kind)
      : allProfiles;

    // Extract the requested metric from each profile
    const scored = filtered.map((p) => {
      let value = 0;
      if (metric === 'errorRate') {
        value = parseFloat(p.errorRate as string || '0');
      } else {
        try {
          const timing = JSON.parse(p.timing as string || '{}');
          value = timing[metric] || 0;
        } catch {
          value = 0;
        }
      }
      return { symbol: p.entitySymbol as string, value };
    });

    scored.sort((a, b) => b.value - a.value);
    const hotspots = scored.slice(0, topN || 10);

    return { variant: 'ok', hotspots: JSON.stringify(hotspots) };
  },

  async slowChains(input: Record<string, unknown>, storage: ConceptStorage) {
    const thresholdMs = input.thresholdMs as number;

    // Find all sync entities and their associated profiles
    const allSyncs = await storage.find('sync-entity');
    const allProfiles = await storage.find('performance-profile');

    // Build a map of symbol -> p90 timing
    const profileMap = new Map<string, number>();
    for (const p of allProfiles) {
      try {
        const timing = JSON.parse(p.timing as string || '{}');
        profileMap.set(p.entitySymbol as string, timing.p90 || 0);
      } catch {
        // skip
      }
    }

    // For each sync, trace its chain and sum p90 timings
    const chains: Array<Record<string, unknown>> = [];
    for (const sync of allSyncs) {
      const syncSymbol = sync.symbol as string;
      const p90 = profileMap.get(syncSymbol) || 0;

      // Sum timings along the then-action chain
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

    return { variant: 'ok', chains: JSON.stringify(chains) };
  },

  async compareWindows(input: Record<string, unknown>, storage: ConceptStorage) {
    const symbol = input.symbol as string;
    const windowA = input.windowA as string;
    const windowB = input.windowB as string;

    // Find performance data for each window
    const profilesA = await storage.find('performance-profile', { entitySymbol: symbol });
    const profilesB = await storage.find('performance-profile', { entitySymbol: symbol });

    // Filter by window
    let dataA: Record<string, unknown> | null = null;
    let dataB: Record<string, unknown> | null = null;

    for (const p of profilesA) {
      if (p.sampleWindow === windowA) { dataA = p; break; }
    }
    for (const p of profilesB) {
      if (p.sampleWindow === windowB) { dataB = p; break; }
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
    const regression = bP50 > aP50 * 1.1; // 10% threshold

    return {
      variant: 'ok',
      comparison: JSON.stringify({
        aP50, bP50, aP99, bP99,
        regression,
        pctChange,
      }),
    };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const profile = input.profile as string;

    const record = await storage.get('performance-profile', profile);
    if (!record) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      profile: record.id as string,
      entitySymbol: record.entitySymbol as string,
      entityKind: record.entityKind as string,
      invocationCount: (record.invocationCount as number) || 0,
      errorRate: record.errorRate as string,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetPerformanceProfileCounter(): void {
  idCounter = 0;
}
