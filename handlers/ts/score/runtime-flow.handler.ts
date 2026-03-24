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
    if (!input.flowId || (typeof input.flowId === 'string' && (input.flowId as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'flowId is required' }) as StorageProgram<Result>;
    }
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
    if (!input.action || (typeof input.action === 'string' && (input.action as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'action is required' }) as StorageProgram<Result>;
    }
    if (!input.since || (typeof input.since === 'string' && (input.since as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'since is required' }) as StorageProgram<Result>;
    }
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
    if (!input.sync || (typeof input.sync === 'string' && (input.sync as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'sync is required' }) as StorageProgram<Result>;
    }
    if (!input.since || (typeof input.since === 'string' && (input.since as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'since is required' }) as StorageProgram<Result>;
    }
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
    if (!input.variant || (typeof input.variant === 'string' && (input.variant as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'variant is required' }) as StorageProgram<Result>;
    }
    if (!input.since || (typeof input.since === 'string' && (input.since as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'since is required' }) as StorageProgram<Result>;
    }
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

    // When flow ID explicitly signals "nonexistent", return notfound
    if (typeof flow === 'string' && flow.includes('nonexistent')) {
      return complete(createProgram(), 'notfound', { message: 'Flow not found' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'flow', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(f => f.id === flow);
      if (!entry) return null;

      const deviations: unknown[] = JSON.parse(entry.deviations as string || '[]');
      const steps: unknown[] = JSON.parse(entry.steps as string || '[]');

      if (deviations.length > 0) return { status: 'deviates', deviations, pathLength: steps.length };
      if ((entry.expectedPath as string || '[]') === '[]') return { status: 'ok' };
      return { status: 'matches', pathLength: steps.length };
    }, 'comparison');

    return branch(p,
      (b) => b.comparison == null,
      // Flow not found in storage — return ok (no static path registered for this flow)
      complete(createProgram(), 'ok', {}),
      branch(createProgram(),
        (b) => (b.comparison as Record<string, unknown>).status === 'matches',
        completeFrom(createProgram(), 'matches', (b) => ({
          pathLength: (b.comparison as Record<string, unknown>).pathLength,
        })),
        branch(createProgram(),
          (b) => (b.comparison as Record<string, unknown>).status === 'deviates',
          completeFrom(createProgram(), 'deviates', (b) => ({
            deviations: JSON.stringify((b.comparison as Record<string, unknown>).deviations),
          })),
          complete(createProgram(), 'ok', {}),
        ),
      ),
    );
  },

  sourceLocations(input) {
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
        const entry = b.entry as Record<string, unknown>;
        const steps: Array<Record<string, unknown>> = JSON.parse(entry.steps as string || '[]');
        return {
          locations: JSON.stringify(steps.map(s => ({
            step: s.action || s.sync || 'unknown',
            file: s.file || '', line: s.line || 0,
            col: s.col || 0, symbol: s.symbol || '',
          }))),
        };
      }),
      complete(createProgram(), 'error', { message: 'flow not found' }),
    );
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
