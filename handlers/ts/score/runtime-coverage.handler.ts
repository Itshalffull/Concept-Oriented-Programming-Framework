// @clef-handler style=functional
// ============================================================
// RuntimeCoverage Concept Implementation (Functional)
//
// Tracks which static entities have been exercised at runtime.
// Independent concept — static entity cross-referencing done
// at the ScoreApi level. This concept only tracks execution data.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, get, find, put, merge, mergeFrom, branch, complete, completeFrom, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const runtimeCoverageHandler: FunctionalConceptHandler = {

  record(input) {
    if (!input.symbol || (typeof input.symbol === 'string' && (input.symbol as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'symbol is required' }) as StorageProgram<Result>;
    }
    const symbol = input.symbol as string;
    const kind = input.kind as string;
    const flowId = input.flowId as string;
    const key = `coverage:${symbol}`;
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'coverage', key, 'existing');

    return branch(p,
      (b) => b.existing != null,
      // Update existing entry
      (() => {
        let q = createProgram();
        q = mapBindings(q, (b) => {
          const e = b.existing as Record<string, unknown>;
          const flowIds: string[] = JSON.parse(e.flowIds as string || '[]');
          flowIds.push(flowId);
          return { lastExercised: now, executionCount: ((e.executionCount as number) || 0) + 1, flowIds: JSON.stringify(flowIds) };
        }, 'updates');
        q = mergeFrom(q, 'coverage', key, (b) => b.updates as Record<string, unknown>);
        return completeFrom(q, 'ok', (b) => {
          const e = b.existing as Record<string, unknown>;
          return { entry: e.id };
        });
      })(),
      // Create new entry — first time exercised
      (() => {
        const id = crypto.randomUUID();
        let q = createProgram();
        q = put(q, 'coverage', key, {
          id, entitySymbol: symbol, entityKind: kind,
          firstExercised: now, lastExercised: now,
          executionCount: 1,
          flowIds: JSON.stringify([flowId]),
        });
        return complete(q, 'ok', { entry: id });
      })(),
    );
  },

  coverageReport(input) {
    if (!input.kind || (typeof input.kind === 'string' && (input.kind as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'kind is required' }) as StorageProgram<Result>;
    }
    if (!input.since || (typeof input.since === 'string' && (input.since as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'since is required' }) as StorageProgram<Result>;
    }
    const kind = input.kind as string;

    let p = createProgram();
    p = find(p, 'coverage', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const ofKind = all.filter(e => e.entityKind === kind);
      return JSON.stringify({
        totalEntities: ofKind.length,
        exercised: ofKind.filter(e => (e.executionCount as number) > 0).length,
        unexercised: ofKind.filter(e => (e.executionCount as number) === 0).length,
        coveragePct: ofKind.length > 0
          ? Math.round((ofKind.filter(e => (e.executionCount as number) > 0).length / ofKind.length) * 100)
          : 0,
      });
    }, 'report');

    return completeFrom(p, 'ok', (b) => ({ report: b.report }));
  },

  variantCoverage(input) {
    if (!input.concept || (typeof input.concept === 'string' && (input.concept as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'concept is required' }) as StorageProgram<Result>;
    }
    const concept = input.concept as string;

    let p = createProgram();
    p = find(p, 'coverage', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const variants = all.filter(e =>
        e.entityKind === 'variant' &&
        (e.entitySymbol as string).startsWith(`clef/variant/${concept}/`),
      );
      return JSON.stringify(variants.map(v => ({
        action: (v.entitySymbol as string).split('/')[3] || '',
        variant: (v.entitySymbol as string).split('/')[4] || '',
        exercised: (v.executionCount as number) > 0,
        count: v.executionCount,
        lastSeen: v.lastExercised,
      })));
    }, 'report');

    return completeFrom(p, 'ok', (b) => ({ report: b.report }));
  },

  syncCoverage(input) {
    let p = createProgram();
    p = find(p, 'coverage', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const syncs = all.filter(e => e.entityKind === 'sync');
      return JSON.stringify(syncs.map(s => ({
        sync: s.entitySymbol,
        tier: '',
        exercised: (s.executionCount as number) > 0,
        count: s.executionCount,
        avgDurationMs: 0,
      })));
    }, 'report');

    return completeFrom(p, 'ok', (b) => ({ report: b.report }));
  },

  widgetStateCoverage(input) {
    if (!input.widget || (typeof input.widget === 'string' && (input.widget as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'widget is required' }) as StorageProgram<Result>;
    }
    const widget = input.widget as string;

    let p = createProgram();
    p = find(p, 'coverage', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const states = all.filter(e =>
        e.entityKind === 'widget-state' &&
        (e.entitySymbol as string).includes(`/widget/${widget}/`),
      );
      return JSON.stringify(states.map(s => ({
        state: (e => e.split('/').pop())(s.entitySymbol as string),
        entered: (s.executionCount as number) > 0,
        count: s.executionCount,
        transitionsExercised: [],
        transitionsUnexercised: [],
      })));
    }, 'report');

    return completeFrom(p, 'ok', (b) => ({ report: b.report }));
  },

  widgetLifecycleReport(input) {
    if (!input.widget || (typeof input.widget === 'string' && (input.widget as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'widget is required' }) as StorageProgram<Result>;
    }
    if (!input.since || (typeof input.since === 'string' && (input.since as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'since is required' }) as StorageProgram<Result>;
    }
    const widget = input.widget as string;

    let p = createProgram();
    p = find(p, 'coverage', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const widgetEntries = all.filter(e =>
        (e.entitySymbol as string).includes(`/widget/${widget}`),
      );

      const mounts = widgetEntries.find(e => e.entityKind === 'widget-mount');
      const unmounts = widgetEntries.find(e => e.entityKind === 'widget-unmount');
      const renders = widgetEntries.find(e => e.entityKind === 'widget-render');
      const unnecessaryRenders = widgetEntries.find(e => e.entityKind === 'widget-unnecessary-render');

      return JSON.stringify({
        mountCount: (mounts?.executionCount as number) || 0,
        unmountCount: (unmounts?.executionCount as number) || 0,
        renderCount: (renders?.executionCount as number) || 0,
        unnecessaryRenderPct: renders && unnecessaryRenders
          ? Math.round(((unnecessaryRenders.executionCount as number) / (renders.executionCount as number)) * 100)
          : 0,
        activeInstances: ((mounts?.executionCount as number) || 0) - ((unmounts?.executionCount as number) || 0),
      });
    }, 'report');

    return completeFrom(p, 'ok', (b) => ({ report: b.report }));
  },

  widgetRenderTrace(input) {
    if (!input.widgetInstance || (typeof input.widgetInstance === 'string' && (input.widgetInstance as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'widgetInstance is required' }) as StorageProgram<Result>;
    }
    const widgetInstance = input.widgetInstance as string;
    const key = `coverage:${widgetInstance}`;

    let p = createProgram();
    p = get(p, 'coverage', key, 'entry');

    return branch(p,
      (b) => b.entry != null,
      completeFrom(createProgram(), 'ok', (b) => ({
        renders: (b.entry as Record<string, unknown>).flowIds as string || '[]',
      })),
      complete(createProgram(), 'notfound', {}),
    );
  },

  widgetComparison(input) {
    const topN = (input.topN as number) || 10;

    let p = createProgram();
    p = find(p, 'coverage', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const widgets = all
        .filter(e => e.entityKind === 'widget-render')
        .sort((a, c) => ((c.executionCount as number) || 0) - ((a.executionCount as number) || 0))
        .slice(0, topN);

      return JSON.stringify(widgets.map(w => ({
        widget: w.entitySymbol,
        mountCount: 0, totalRenders: w.executionCount,
        unnecessaryRenderPct: 0, avgRenderMs: 0, p90RenderMs: 0,
      })));
    }, 'ranking');

    return completeFrom(p, 'ok', (b) => ({ ranking: b.ranking }));
  },

  deadAtRuntime(input) {
    if (!input.kind || (typeof input.kind === 'string' && (input.kind as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'kind is required' }) as StorageProgram<Result>;
    }
    const kind = input.kind as string;

    let p = createProgram();
    p = find(p, 'coverage', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const dead = all
        .filter(e => e.entityKind === kind && (e.executionCount as number) === 0)
        .map(e => e.entitySymbol);
      return JSON.stringify(dead);
    }, 'neverExercised');

    return completeFrom(p, 'ok', (b) => ({ neverExercised: b.neverExercised }));
  },
};
