// ============================================================
// RuntimeCoverage Handler
//
// Tracks which static entities have been exercised at runtime --
// the bridge between declared structure and observed behavior.
// Answers "which declared syncs/variants/widget states have
// actually fired in production?" Combined with static dead-variant
// analysis, gives the complete picture: statically dead vs
// dynamically dead.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `runtime-coverage-${++idCounter}`;
}

export const runtimeCoverageHandler: ConceptHandler = {
  async record(input: Record<string, unknown>, storage: ConceptStorage) {
    const symbol = input.symbol as string;
    const kind = input.kind as string;
    const flowId = input.flowId as string;

    const now = new Date().toISOString();

    // Check if we already have a coverage entry for this symbol
    const existing = await storage.find('runtime-coverage', { symbol });

    if (existing.length > 0) {
      const entry = existing[0];
      const id = entry.id as string;
      const executionCount = ((entry.executionCount as number) || 0) + 1;

      // Parse existing flowIds and add new one
      let flowIds: string[] = [];
      try {
        flowIds = JSON.parse(entry.flowIds as string || '[]');
      } catch {
        flowIds = [];
      }
      flowIds.push(flowId);

      await storage.put('runtime-coverage', id, {
        ...entry,
        lastExercised: now,
        executionCount,
        flowIds: JSON.stringify(flowIds),
      });

      return { variant: 'ok', entry: id };
    }

    // First time this entity is exercised
    const id = nextId();

    await storage.put('runtime-coverage', id, {
      id,
      entitySymbol: symbol,
      symbol,
      entityKind: kind,
      firstExercised: now,
      lastExercised: now,
      executionCount: 1,
      flowIds: JSON.stringify([flowId]),
    });

    return { variant: 'created', entry: id };
  },

  async coverageReport(input: Record<string, unknown>, storage: ConceptStorage) {
    const kind = input.kind as string;
    const since = input.since as string;

    // Get all coverage entries for this kind
    const entries = await storage.find('runtime-coverage', { entityKind: kind });
    const filtered = since && since !== ''
      ? entries.filter((e) => (e.lastExercised as string) >= since)
      : entries;

    // Get all registered entities of this kind for total count
    let totalEntities = 0;
    if (kind === 'action') {
      totalEntities = (await storage.find('action-entity')).length;
    } else if (kind === 'variant') {
      totalEntities = (await storage.find('variant-entity')).length;
    } else if (kind === 'sync') {
      totalEntities = (await storage.find('sync-entity')).length;
    } else if (kind === 'widget-state') {
      totalEntities = (await storage.find('widget-state-entity')).length;
    } else if (kind === 'state-field') {
      totalEntities = (await storage.find('state-field')).length;
    } else {
      // Fallback: count all entries of this kind
      totalEntities = (await storage.find('runtime-coverage', { entityKind: kind })).length;
    }

    const exercised = filtered.length;
    const unexercised = Math.max(0, totalEntities - exercised);
    const coveragePct = totalEntities > 0
      ? parseFloat(((exercised / totalEntities) * 100).toFixed(2))
      : 0;

    return {
      variant: 'ok',
      report: JSON.stringify({
        totalEntities,
        exercised,
        unexercised,
        coveragePct,
      }),
    };
  },

  async variantCoverage(input: Record<string, unknown>, storage: ConceptStorage) {
    const concept = input.concept as string;

    // Get all actions for this concept
    const actions = await storage.find('action-entity', { concept });

    // Get all variants for those actions
    const report: Array<Record<string, unknown>> = [];
    for (const action of actions) {
      const actionRef = `${concept}/${action.name}`;
      const variants = await storage.find('variant-entity', { action: actionRef });

      for (const v of variants) {
        const symbol = v.symbol as string;
        const coverage = await storage.find('runtime-coverage', { symbol });

        const entry = coverage.length > 0 ? coverage[0] : null;
        report.push({
          action: actionRef,
          variant: v.tag,
          exercised: entry !== null,
          count: entry ? (entry.executionCount as number) || 0 : 0,
          lastSeen: entry ? (entry.lastExercised as string) || '' : '',
        });
      }
    }

    return { variant: 'ok', report: JSON.stringify(report) };
  },

  async syncCoverage(input: Record<string, unknown>, storage: ConceptStorage) {
    const since = input.since as string;

    const allSyncs = await storage.find('sync-entity');
    const report: Array<Record<string, unknown>> = [];

    for (const sync of allSyncs) {
      const symbol = sync.symbol as string;
      const coverage = await storage.find('runtime-coverage', { symbol });

      const entry = coverage.length > 0 ? coverage[0] : null;
      let avgDurationMs = 0;

      if (entry) {
        // Check performance profile for timing data
        const profiles = await storage.find('performance-profile', { entitySymbol: symbol });
        if (profiles.length > 0) {
          try {
            const timing = JSON.parse(profiles[0].timing as string || '{}');
            avgDurationMs = timing.p50 || 0;
          } catch {
            // default
          }
        }
      }

      const exercised = entry !== null;
      if (since && since !== '' && entry) {
        if ((entry.lastExercised as string) < since) continue;
      }

      report.push({
        sync: sync.name,
        tier: sync.tier || 'standard',
        exercised,
        count: entry ? (entry.executionCount as number) || 0 : 0,
        avgDurationMs,
      });
    }

    return { variant: 'ok', report: JSON.stringify(report) };
  },

  async widgetStateCoverage(input: Record<string, unknown>, storage: ConceptStorage) {
    const widget = input.widget as string;

    const allStates = await storage.find('widget-state-entity', { widget });
    const report: Array<Record<string, unknown>> = [];

    for (const state of allStates) {
      const symbol = state.symbol as string;
      const coverage = await storage.find('runtime-coverage', { symbol });

      const entry = coverage.length > 0 ? coverage[0] : null;

      // Analyze transitions
      let transitions: Array<Record<string, unknown>> = [];
      try {
        transitions = JSON.parse(state.transitions as string || '[]');
      } catch {
        // empty
      }

      const transitionsExercised: string[] = [];
      const transitionsUnexercised: string[] = [];
      for (const t of transitions) {
        const transSymbol = `${symbol}/${(t.event || t.on) as string}`;
        const transCoverage = await storage.find('runtime-coverage', { symbol: transSymbol });
        if (transCoverage.length > 0) {
          transitionsExercised.push((t.event || t.on) as string);
        } else {
          transitionsUnexercised.push((t.event || t.on) as string);
        }
      }

      report.push({
        state: state.name,
        entered: entry !== null,
        count: entry ? (entry.executionCount as number) || 0 : 0,
        transitionsExercised,
        transitionsUnexercised,
      });
    }

    return { variant: 'ok', report: JSON.stringify(report) };
  },

  async widgetLifecycleReport(input: Record<string, unknown>, storage: ConceptStorage) {
    const widget = input.widget as string;
    const since = input.since as string;

    const widgetSymbol = `copf/widget/${widget}`;

    // Gather coverage entries for various lifecycle events
    const mountEntries = await storage.find('runtime-coverage', { symbol: `${widgetSymbol}/mount`, entityKind: 'widget-mount' });
    const unmountEntries = await storage.find('runtime-coverage', { symbol: `${widgetSymbol}/unmount`, entityKind: 'widget-unmount' });
    const renderEntries = await storage.find('runtime-coverage', { symbol: `${widgetSymbol}/render`, entityKind: 'widget-render' });
    const unnecessaryRenders = await storage.find('runtime-coverage', { symbol: `${widgetSymbol}/unnecessary-render`, entityKind: 'widget-unnecessary-render' });
    const propChanges = await storage.find('runtime-coverage', { symbol: `${widgetSymbol}/prop-change`, entityKind: 'widget-prop-change' });
    const slotFills = await storage.find('runtime-coverage', { symbol: `${widgetSymbol}/slot-fill`, entityKind: 'slot-fill' });

    const mountCount = mountEntries.reduce((sum, e) => sum + ((e.executionCount as number) || 0), 0);
    const unmountCount = unmountEntries.reduce((sum, e) => sum + ((e.executionCount as number) || 0), 0);
    const renderCount = renderEntries.reduce((sum, e) => sum + ((e.executionCount as number) || 0), 0);
    const unnecessaryCount = unnecessaryRenders.reduce((sum, e) => sum + ((e.executionCount as number) || 0), 0);
    const unnecessaryPct = renderCount > 0 ? ((unnecessaryCount / renderCount) * 100).toFixed(2) : '0';

    const report = {
      widget,
      mountCount,
      unmountCount,
      activeInstances: Math.max(0, mountCount - unmountCount),
      renderCount,
      unnecessaryRenderPct: parseFloat(unnecessaryPct),
      propChangeSources: propChanges.length,
      slotActivity: slotFills.length,
    };

    return { variant: 'ok', report: JSON.stringify(report) };
  },

  async widgetRenderTrace(input: Record<string, unknown>, storage: ConceptStorage) {
    const widgetInstance = input.widgetInstance as string;

    // Look up render entries for this specific instance
    const renders = await storage.find('runtime-coverage', { symbol: widgetInstance, entityKind: 'widget-render' });

    if (renders.length === 0) {
      return { variant: 'notfound' };
    }

    // Build the render trace from flow IDs
    const traces: Array<Record<string, unknown>> = [];
    for (const r of renders) {
      try {
        const flowIds = JSON.parse(r.flowIds as string || '[]');
        for (const fid of flowIds) {
          traces.push({
            flowId: fid,
            timestamp: r.lastExercised || '',
            duration: 0,
            trigger: 'signal',
            propsChanged: [],
            necessary: true,
          });
        }
      } catch {
        // skip
      }
    }

    return { variant: 'ok', renders: JSON.stringify(traces) };
  },

  async widgetComparison(input: Record<string, unknown>, storage: ConceptStorage) {
    const since = input.since as string;
    const topN = input.topN as number;

    const allWidgets = await storage.find('widget-entity');
    const ranking: Array<Record<string, unknown>> = [];

    for (const w of allWidgets) {
      const widgetName = w.name as string;
      const widgetSymbol = `copf/widget/${widgetName}`;

      const mountEntries = await storage.find('runtime-coverage', { symbol: `${widgetSymbol}/mount`, entityKind: 'widget-mount' });
      const renderEntries = await storage.find('runtime-coverage', { symbol: `${widgetSymbol}/render`, entityKind: 'widget-render' });
      const unnecessaryRenders = await storage.find('runtime-coverage', { symbol: `${widgetSymbol}/unnecessary-render`, entityKind: 'widget-unnecessary-render' });

      const mountCount = mountEntries.reduce((sum, e) => sum + ((e.executionCount as number) || 0), 0);
      const totalRenders = renderEntries.reduce((sum, e) => sum + ((e.executionCount as number) || 0), 0);
      const unnecessaryCount = unnecessaryRenders.reduce((sum, e) => sum + ((e.executionCount as number) || 0), 0);

      // Get timing from performance profile
      let avgRenderMs = 0;
      let p90RenderMs = 0;
      const profiles = await storage.find('performance-profile', { entitySymbol: widgetSymbol });
      if (profiles.length > 0) {
        try {
          const timing = JSON.parse(profiles[0].timing as string || '{}');
          avgRenderMs = timing.p50 || 0;
          p90RenderMs = timing.p90 || 0;
        } catch {
          // defaults
        }
      }

      ranking.push({
        widget: widgetName,
        mountCount,
        totalRenders,
        unnecessaryRenderPct: totalRenders > 0 ? parseFloat(((unnecessaryCount / totalRenders) * 100).toFixed(2)) : 0,
        avgRenderMs,
        p90RenderMs,
      });
    }

    // Sort by total renders descending
    ranking.sort((a, b) => (b.totalRenders as number) - (a.totalRenders as number));

    return { variant: 'ok', ranking: JSON.stringify(ranking.slice(0, topN || 20)) };
  },

  async deadAtRuntime(input: Record<string, unknown>, storage: ConceptStorage) {
    const kind = input.kind as string;

    // Get all registered entities of this kind
    let allEntities: Record<string, unknown>[] = [];
    if (kind === 'action') {
      allEntities = await storage.find('action-entity');
    } else if (kind === 'variant') {
      allEntities = await storage.find('variant-entity');
    } else if (kind === 'sync') {
      allEntities = await storage.find('sync-entity');
    } else if (kind === 'widget-state') {
      allEntities = await storage.find('widget-state-entity');
    } else if (kind === 'state-field') {
      allEntities = await storage.find('state-field');
    }

    // Get all exercised symbols
    const exercised = await storage.find('runtime-coverage', { entityKind: kind });
    const exercisedSymbols = new Set(exercised.map((e) => e.symbol as string));

    // Find never-exercised
    const neverExercised = allEntities
      .filter((e) => !exercisedSymbols.has(e.symbol as string))
      .map((e) => e.symbol as string);

    return { variant: 'ok', neverExercised: JSON.stringify(neverExercised) };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetRuntimeCoverageCounter(): void {
  idCounter = 0;
}
