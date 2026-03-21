// @clef-handler style=functional
// ============================================================
// RuntimeFlow Concept Implementation (Functional)
//
// Enriched execution flow that correlates ActionLog events with
// static semantic entities. Independent concept — static entity
// resolution populated by syncs from ActionLog/FlowTrace.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, get, find, put, branch, complete, completeFrom, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const runtimeFlowHandler: FunctionalConceptHandler = {

  correlate(input) {
    const flowId = input.flowId as string;
    const id = crypto.randomUUID();
    const key = `flow:${flowId}`;

    // Check if already correlated
    let p = createProgram();
    p = get(p, 'flow', key, 'existing');

    return branch(p,
      (b) => b.existing != null,
      completeFrom(createProgram(), 'ok', (b) => ({
        flow: (b.existing as Record<string, unknown>).id,
      })),
      // Create new correlated flow — actual correlation with ActionLog
      // events happens via syncs from ActionLog/append
      complete(
        put(createProgram(), 'flow', key, {
          id, flowId,
          startedAt: new Date().toISOString(),
          completedAt: '',
          status: 'pending',
          trigger: '',
          steps: '[]',
          expectedPath: '[]',
          deviations: '[]',
        }),
        'ok', { flow: id },
      ),
    );
  },

  findByAction(input) {
    const action = input.action as string;

    let p = createProgram();
    p = find(p, 'flow', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const matching = all.filter(f => {
        const steps: Array<{ action?: string }> = JSON.parse(f.steps as string || '[]');
        return steps.some(s => s.action === action);
      });
      return JSON.stringify(matching.map(f => ({ id: f.id, flowId: f.flowId, status: f.status })));
    }, 'result');

    return completeFrom(p, 'ok', (b) => ({ flows: b.result }));
  },

  findBySync(input) {
    const sync = input.sync as string;

    let p = createProgram();
    p = find(p, 'flow', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const matching = all.filter(f => {
        const steps: Array<{ sync?: string }> = JSON.parse(f.steps as string || '[]');
        return steps.some(s => s.sync === sync);
      });
      return JSON.stringify(matching.map(f => ({ id: f.id, flowId: f.flowId, status: f.status })));
    }, 'result');

    return completeFrom(p, 'ok', (b) => ({ flows: b.result }));
  },

  findByVariant(input) {
    const variant = input.variant as string;

    let p = createProgram();
    p = find(p, 'flow', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const matching = all.filter(f => {
        const steps: Array<{ variant?: string }> = JSON.parse(f.steps as string || '[]');
        return steps.some(s => s.variant === variant);
      });
      return JSON.stringify(matching.map(f => ({ id: f.id, flowId: f.flowId, status: f.status })));
    }, 'result');

    return completeFrom(p, 'ok', (b) => ({ flows: b.result }));
  },

  findFailures(input) {
    let p = createProgram();
    p = find(p, 'flow', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const failures = all.filter(f => f.status === 'failed' || f.status === 'timeout');
      return JSON.stringify(failures.map(f => ({ id: f.id, flowId: f.flowId, status: f.status })));
    }, 'result');

    return completeFrom(p, 'ok', (b) => ({ flows: b.result }));
  },

  compareToStatic(input) {
    const flow = input.flow as string;

    let p = createProgram();
    p = find(p, 'flow', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(f => f.id === flow);
      if (!entry) return { status: 'noPath' };

      const deviations: unknown[] = JSON.parse(entry.deviations as string || '[]');
      const steps: unknown[] = JSON.parse(entry.steps as string || '[]');

      if (deviations.length > 0) return { status: 'deviates', deviations, pathLength: steps.length };
      if (steps.length === 0) return { status: 'noPath' };
      return { status: 'matches', pathLength: steps.length };
    }, 'comparison');

    return branch(p,
      (b) => (b.comparison as Record<string, unknown>).status === 'matches',
      pureFrom(createProgram(), (b) => ({
        variant: 'matches',
        pathLength: (b.comparison as Record<string, unknown>).pathLength,
      })),
      branch(createProgram(),
        (b) => (b.comparison as Record<string, unknown>).status === 'deviates',
        pureFrom(createProgram(), (b) => ({
          variant: 'deviates',
          deviations: JSON.stringify((b.comparison as Record<string, unknown>).deviations),
        })),
        complete(createProgram(), 'noStaticPath', {}),
      ),
    );
  },

  sourceLocations(input) {
    const flow = input.flow as string;

    let p = createProgram();
    p = find(p, 'flow', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(f => f.id === flow);
      if (!entry) return '[]';

      // Source locations populated by syncs from HandlerEntity/resolveStackFrame
      const steps: Array<Record<string, unknown>> = JSON.parse(entry.steps as string || '[]');
      return JSON.stringify(steps.map(s => ({
        step: s.action || s.sync || 'unknown',
        file: s.file || '', line: s.line || 0,
        col: s.col || 0, symbol: s.symbol || '',
      })));
    }, 'locations');

    return completeFrom(p, 'ok', (b) => ({ locations: b.locations }));
  },

  get(input) {
    const flow = input.flow as string;

    let p = createProgram();
    p = find(p, 'flow', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.find(f => f.id === flow) || null;
    }, 'entry');

    return branch(p,
      (b) => b.entry != null,
      completeFrom(createProgram(), 'ok', (b) => {
        const e = b.entry as Record<string, unknown>;
        const steps: unknown[] = JSON.parse(e.steps as string || '[]');
        const deviations: unknown[] = JSON.parse(e.deviations as string || '[]');
        return {
          flow: e.id, flowId: e.flowId,
          status: e.status, stepCount: steps.length, deviationCount: deviations.length,
        };
      }),
      complete(createProgram(), 'notfound', {}),
    );
  },
};
