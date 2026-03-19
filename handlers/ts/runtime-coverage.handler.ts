// @migrated dsl-constructs 2026-03-18
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

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import type { ConceptStorage } from '../../runtime/types.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings, putFrom, mergeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `runtime-coverage-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  coverageReport(input: Record<string, unknown>) {
    const kind = input.kind as string;
    const since = input.since as string;

    // Map kind to entity relation name
    const entityRelation = kind === 'action' ? 'action-entity'
      : kind === 'variant' ? 'variant-entity'
      : kind === 'sync' ? 'sync-entity'
      : kind === 'widget-state' ? 'widget-state-entity'
      : kind === 'state-field' ? 'state-field'
      : 'action-entity';

    let p = createProgram();
    p = find(p, entityRelation, {}, 'allEntities');
    p = find(p, 'runtime-coverage', { entityKind: kind }, 'entries');

    return completeFrom(p, 'ok', (bindings) => {
      const allEntities = bindings.allEntities as Record<string, unknown>[];
      const entries = bindings.entries as Record<string, unknown>[];
      const filtered = since && since !== ''
        ? entries.filter((e) => (e.lastExercised as string) >= since)
        : entries;

      const exercised = filtered.length;
      const totalEntities = allEntities.length;
      const unexercised = Math.max(0, totalEntities - exercised);
      const coveragePct = totalEntities > 0
        ? parseFloat(((exercised / totalEntities) * 100).toFixed(2))
        : 0;

      return {
        report: JSON.stringify({
          totalEntities,
          exercised,
          unexercised,
          coveragePct,
        }),
      };
    }) as StorageProgram<Result>;
  },

  variantCoverage(input: Record<string, unknown>) {
    const concept = input.concept as string;

    let p = createProgram();
    p = find(p, 'action-entity', { concept }, 'actions');
    p = find(p, 'variant-entity', {}, 'allVariants');
    p = find(p, 'runtime-coverage', {}, 'allCoverage');

    return completeFrom(p, 'ok', (bindings) => {
      const actions = bindings.actions as Record<string, unknown>[];
      const allVariants = bindings.allVariants as Record<string, unknown>[];
      const allCoverage = bindings.allCoverage as Record<string, unknown>[];

      const report: Array<Record<string, unknown>> = [];
      for (const action of actions) {
        const actionRef = `${concept}/${action.name}`;
        const variants = allVariants.filter(v => v.action === actionRef);

        for (const v of variants) {
          const symbol = v.symbol as string;
          const coverage = allCoverage.filter(c => c.symbol === symbol);

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

      return { report: JSON.stringify(report) };
    }) as StorageProgram<Result>;
  },

  syncCoverage(input: Record<string, unknown>) {
    const since = input.since as string;

    let p = createProgram();
    p = find(p, 'sync-entity', {}, 'allSyncs');
    p = find(p, 'runtime-coverage', {}, 'allCoverage');

    return completeFrom(p, 'ok', (bindings) => {
      const allSyncs = bindings.allSyncs as Record<string, unknown>[];
      const allCoverage = bindings.allCoverage as Record<string, unknown>[];

      const report: Array<Record<string, unknown>> = [];

      for (const sync of allSyncs) {
        const symbol = sync.symbol as string;
        const coverage = allCoverage.filter(c => c.symbol === symbol);

        const entry = coverage.length > 0 ? coverage[0] : null;
        const exercised = entry !== null;

        if (since && since !== '' && entry) {
          if ((entry.lastExercised as string) < since) continue;
        }

        report.push({
          sync: sync.name,
          tier: sync.tier || 'standard',
          exercised,
          count: entry ? (entry.executionCount as number) || 0 : 0,
          avgDurationMs: 0,
        });
      }

      return { report: JSON.stringify(report) };
    }) as StorageProgram<Result>;
  },

  widgetStateCoverage(input: Record<string, unknown>) {
    const widget = input.widget as string;

    let p = createProgram();
    p = find(p, 'widget-state-entity', { widget }, 'allStates');
    p = find(p, 'runtime-coverage', {}, 'allCoverage');

    return completeFrom(p, 'ok', (bindings) => {
      const allStates = bindings.allStates as Record<string, unknown>[];
      const allCoverage = bindings.allCoverage as Record<string, unknown>[];

      const report: Array<Record<string, unknown>> = [];

      for (const state of allStates) {
        const symbol = state.symbol as string;
        const coverage = allCoverage.filter(c => c.symbol === symbol);
        const entry = coverage.length > 0 ? coverage[0] : null;

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
          const transCoverage = allCoverage.filter(c => c.symbol === transSymbol);
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

      return { report: JSON.stringify(report) };
    }) as StorageProgram<Result>;
  },

  widgetLifecycleReport(input: Record<string, unknown>) {
    const widget = input.widget as string;
    const since = input.since as string;

    const widgetSymbol = `clef/widget/${widget}`;

    let p = createProgram();
    p = find(p, 'runtime-coverage', {}, 'allCoverage');

    return completeFrom(p, 'ok', (bindings) => {
      const allCoverage = bindings.allCoverage as Record<string, unknown>[];

      const mountEntries = allCoverage.filter(e => e.symbol === `${widgetSymbol}/mount` && e.entityKind === 'widget-mount');
      const unmountEntries = allCoverage.filter(e => e.symbol === `${widgetSymbol}/unmount` && e.entityKind === 'widget-unmount');
      const renderEntries = allCoverage.filter(e => e.symbol === `${widgetSymbol}/render` && e.entityKind === 'widget-render');
      const unnecessaryRenders = allCoverage.filter(e => e.symbol === `${widgetSymbol}/unnecessary-render` && e.entityKind === 'widget-unnecessary-render');
      const propChanges = allCoverage.filter(e => e.symbol === `${widgetSymbol}/prop-change` && e.entityKind === 'widget-prop-change');
      const slotFills = allCoverage.filter(e => e.symbol === `${widgetSymbol}/slot-fill` && e.entityKind === 'slot-fill');

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

      return { report: JSON.stringify(report) };
    }) as StorageProgram<Result>;
  },

  widgetRenderTrace(input: Record<string, unknown>) {
    const widgetInstance = input.widgetInstance as string;

    let p = createProgram();
    p = find(p, 'runtime-coverage', { symbol: widgetInstance, entityKind: 'widget-render' }, 'renders');

    return completeFrom(p, 'ok', (bindings) => {
      const renders = bindings.renders as Record<string, unknown>[];

      if (renders.length === 0) {
        return { variant: 'notfound' };
      }

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

      return { renders: JSON.stringify(traces) };
    }) as StorageProgram<Result>;
  },

  widgetComparison(input: Record<string, unknown>) {
    const since = input.since as string;
    const topN = input.topN as number;

    let p = createProgram();
    p = find(p, 'widget-entity', {}, 'allWidgets');
    p = find(p, 'runtime-coverage', {}, 'allCoverage');

    return completeFrom(p, 'ok', (bindings) => {
      const allWidgets = bindings.allWidgets as Record<string, unknown>[];
      const allCoverage = bindings.allCoverage as Record<string, unknown>[];

      const ranking: Array<Record<string, unknown>> = [];

      for (const w of allWidgets) {
        const widgetName = w.name as string;
        const widgetSymbol = `clef/widget/${widgetName}`;

        const mountEntries = allCoverage.filter(e => e.symbol === `${widgetSymbol}/mount` && e.entityKind === 'widget-mount');
        const renderEntries = allCoverage.filter(e => e.symbol === `${widgetSymbol}/render` && e.entityKind === 'widget-render');
        const unnecessaryRenders = allCoverage.filter(e => e.symbol === `${widgetSymbol}/unnecessary-render` && e.entityKind === 'widget-unnecessary-render');

        const mountCount = mountEntries.reduce((sum, e) => sum + ((e.executionCount as number) || 0), 0);
        const totalRenders = renderEntries.reduce((sum, e) => sum + ((e.executionCount as number) || 0), 0);
        const unnecessaryCount = unnecessaryRenders.reduce((sum, e) => sum + ((e.executionCount as number) || 0), 0);

        ranking.push({
          widget: widgetName,
          mountCount,
          totalRenders,
          unnecessaryRenderPct: totalRenders > 0 ? parseFloat(((unnecessaryCount / totalRenders) * 100).toFixed(2)) : 0,
          avgRenderMs: 0,
          p90RenderMs: 0,
        });
      }

      ranking.sort((a, b) => (b.totalRenders as number) - (a.totalRenders as number));

      return { ranking: JSON.stringify(ranking.slice(0, topN || 20)) };
    }) as StorageProgram<Result>;
  },

  deadAtRuntime(input: Record<string, unknown>) {
    const kind = input.kind as string;

    let p = createProgram();
    // Get all registered entities based on kind
    const entityRelation = kind === 'action' ? 'action-entity'
      : kind === 'variant' ? 'variant-entity'
      : kind === 'sync' ? 'sync-entity'
      : kind === 'widget-state' ? 'widget-state-entity'
      : kind === 'state-field' ? 'state-field'
      : 'runtime-coverage';
    p = find(p, entityRelation, {}, 'allEntities');
    p = find(p, 'runtime-coverage', { entityKind: kind }, 'exercised');

    return completeFrom(p, 'ok', (bindings) => {
      const allEntities = bindings.allEntities as Record<string, unknown>[];
      const exercised = bindings.exercised as Record<string, unknown>[];
      const exercisedSymbols = new Set(exercised.map((e) => e.symbol as string));

      const neverExercised = allEntities
        .filter((e) => !exercisedSymbols.has(e.symbol as string))
        .map((e) => e.symbol as string);

      return { neverExercised: JSON.stringify(neverExercised) };
    }) as StorageProgram<Result>;
  },
};

const baseHandler = autoInterpret(_handler);

// record needs imperative style because it requires dynamic storage keys
const handler = {
  ...baseHandler,

  async record(input: Record<string, unknown>, storage: ConceptStorage) {
    const symbol = input.symbol as string;
    const kind = input.kind as string;
    const flowId = input.flowId as string;
    const now = new Date().toISOString();

    const existing = await storage.find('runtime-coverage', { symbol });
    if (existing && existing.length > 0) {
      const entry = existing[0];
      const id = entry.id as string;
      const prevCount = (entry.executionCount as number) || 0;
      const prevFlowIds = JSON.parse(entry.flowIds as string || '[]');
      prevFlowIds.push(flowId);
      const record = {
        id,
        symbol,
        entitySymbol: symbol,
        entityKind: kind,
        executionCount: prevCount + 1,
        flowIds: JSON.stringify(prevFlowIds),
        lastExercised: now,
      };
      await storage.put('runtime-coverage', id, record);
      return { variant: 'ok', entry: id };
    }

    const id = nextId();
    const record = {
      id,
      symbol,
      entitySymbol: symbol,
      entityKind: kind,
      executionCount: 1,
      flowIds: JSON.stringify([flowId]),
      lastExercised: now,
    };
    await storage.put('runtime-coverage', id, record);
    return { variant: 'created', entry: id };
  },
} as any;

export const runtimeCoverageHandler = handler;

/** Reset the ID counter. Useful for testing. */
export function resetRuntimeCoverageCounter(): void {
  idCounter = 0;
}
