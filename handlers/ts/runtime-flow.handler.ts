// @migrated dsl-constructs 2026-03-18
// ============================================================
// RuntimeFlow Handler
//
// Enriched execution flow that correlates ActionLog events with
// static semantic entities -- the resolved version of FlowTrace.
// Enables comparing actual runtime paths against static FlowGraph
// predictions to find deviations, missing syncs, and unexpected
// branches.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `runtime-flow-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  correlate(input: Record<string, unknown>) {
    const flowId = input.flowId as string;

    let p = createProgram();
    p = find(p, 'action-log', { flow: flowId }, 'logEntries');
    p = find(p, 'concept-entity', {}, 'allConcepts');
    p = find(p, 'action-entity', {}, 'allActions');
    p = find(p, 'variant-entity', {}, 'allVariants');
    p = find(p, 'sync-entity', {}, 'allSyncs');
    p = find(p, 'flow-graph', {}, 'allFlowGraphs');

    return completeFrom(p, 'ok', (bindings) => {
      const logEntries = bindings.logEntries as Record<string, unknown>[];
      if (logEntries.length === 0) {
        return { variant: 'notfound' };
      }

      const allConcepts = bindings.allConcepts as Record<string, unknown>[];
      const allActions = bindings.allActions as Record<string, unknown>[];
      const allVariants = bindings.allVariants as Record<string, unknown>[];
      const allSyncs = bindings.allSyncs as Record<string, unknown>[];
      const allFlowGraphs = bindings.allFlowGraphs as Record<string, unknown>[];

      const id = nextId();
      const now = new Date().toISOString();
      const unresolved: Array<Record<string, unknown>> = [];

      const steps: Array<Record<string, unknown>> = [];
      let trigger = '';
      let hasError = false;

      for (const entry of logEntries) {
        const concept = entry.concept as string || '';
        const action = entry.action as string || '';
        const variantName = entry.variant as string || '';

        let conceptEntityId = '';
        let actionEntityId = '';
        let variantEntityId = '';
        let syncEntityId = '';

        if (concept) {
          const conceptResults = allConcepts.filter(c => c.name === concept);
          if (conceptResults.length > 0) {
            conceptEntityId = conceptResults[0].id as string;
          } else {
            unresolved.push({ type: 'concept', name: concept });
          }
        }

        if (concept && action) {
          const actionResults = allActions.filter(a => a.concept === concept && a.name === action);
          if (actionResults.length > 0) {
            actionEntityId = actionResults[0].id as string;
          } else {
            unresolved.push({ type: 'action', name: `${concept}/${action}` });
          }
        }

        if (variantName && concept && action) {
          const variantResults = allVariants.filter(
            v => v.action === `${concept}/${action}` && v.tag === variantName,
          );
          if (variantResults.length > 0) {
            variantEntityId = variantResults[0].id as string;
          }
        }

        if (entry.sync) {
          const syncResults = allSyncs.filter(s => s.name === entry.sync);
          if (syncResults.length > 0) {
            syncEntityId = syncResults[0].id as string;
          }
        }

        if (steps.length === 0) {
          trigger = `${concept}/${action}`;
        }

        const status = entry.type === 'completion' && entry.variant === 'error' ? 'error' : 'ok';
        if (status === 'error') hasError = true;

        steps.push({
          index: steps.length,
          type: entry.type,
          concept,
          action,
          variant: variantName,
          conceptEntity: conceptEntityId,
          actionEntity: actionEntityId,
          variantEntity: variantEntityId,
          syncEntity: syncEntityId,
          timestamp: entry.timestamp || '',
          status,
        });
      }

      const flowStatus = hasError ? 'failed' : 'completed';
      const startedAt = steps.length > 0 ? (steps[0].timestamp as string) || now : now;
      const completedAt = steps.length > 0 ? (steps[steps.length - 1].timestamp as string) || now : now;

      if (unresolved.length > 0) {
        return { variant: 'partial', flow: id, unresolved: JSON.stringify(unresolved) };
      }

      return { flow: id };
    }) as StorageProgram<Result>;
  },

  findByAction(input: Record<string, unknown>) {
    const action = input.action as string;
    const since = input.since as string;

    let p = createProgram();
    p = find(p, 'runtime-flow', {}, 'allFlows');

    return completeFrom(p, 'ok', (bindings) => {
      const allFlows = bindings.allFlows as Record<string, unknown>[];
      const matching = allFlows.filter((f) => {
        try {
          const steps = JSON.parse(f.steps as string || '[]');
          const hasAction = steps.some((s: Record<string, unknown>) => s.action === action);
          if (!hasAction) return false;
          if (since && since !== '') {
            return (f.startedAt as string) >= since;
          }
          return true;
        } catch {
          return false;
        }
      });

      return { flows: JSON.stringify(matching) };
    }) as StorageProgram<Result>;
  },

  findBySync(input: Record<string, unknown>) {
    const sync = input.sync as string;
    const since = input.since as string;

    let p = createProgram();
    p = find(p, 'runtime-flow', {}, 'allFlows');

    return completeFrom(p, 'ok', (bindings) => {
      const allFlows = bindings.allFlows as Record<string, unknown>[];
      const matching = allFlows.filter((f) => {
        try {
          const steps = JSON.parse(f.steps as string || '[]');
          const hasSync = steps.some((s: Record<string, unknown>) => s.syncEntity === sync || s.sync === sync);
          if (!hasSync) return false;
          if (since && since !== '') {
            return (f.startedAt as string) >= since;
          }
          return true;
        } catch {
          return false;
        }
      });

      return { flows: JSON.stringify(matching) };
    }) as StorageProgram<Result>;
  },

  findByVariant(input: Record<string, unknown>) {
    const variantFilter = input.variant as string;
    const since = input.since as string;

    let p = createProgram();
    p = find(p, 'runtime-flow', {}, 'allFlows');

    return completeFrom(p, 'ok', (bindings) => {
      const allFlows = bindings.allFlows as Record<string, unknown>[];
      const matching = allFlows.filter((f) => {
        try {
          const steps = JSON.parse(f.steps as string || '[]');
          const hasVariant = steps.some(
            (s: Record<string, unknown>) =>
              s.variant === variantFilter || s.variantEntity === variantFilter,
          );
          if (!hasVariant) return false;
          if (since && since !== '') {
            return (f.startedAt as string) >= since;
          }
          return true;
        } catch {
          return false;
        }
      });

      return { flows: JSON.stringify(matching) };
    }) as StorageProgram<Result>;
  },

  findFailures(input: Record<string, unknown>) {
    const since = input.since as string;

    let p = createProgram();
    p = find(p, 'runtime-flow', {}, 'allFlows');

    return completeFrom(p, 'ok', (bindings) => {
      const allFlows = bindings.allFlows as Record<string, unknown>[];
      const failures = allFlows.filter((f) => {
        const status = f.status as string;
        if (status !== 'failed' && status !== 'timeout') return false;
        if (since && since !== '') {
          return (f.startedAt as string) >= since;
        }
        return true;
      });

      return { flows: JSON.stringify(failures) };
    }) as StorageProgram<Result>;
  },

  compareToStatic(input: Record<string, unknown>) {
    const flow = input.flow as string;

    let p = createProgram();
    p = get(p, 'runtime-flow', flow, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          try {
            const deviations = JSON.parse(record.deviations as string || '[]');
            const steps = JSON.parse(record.steps as string || '[]');

            if (deviations.length === 0) {
              return { variant: 'matches', pathLength: steps.length };
            }

            return { variant: 'deviates', deviations: JSON.stringify(deviations) };
          } catch {
            return { variant: 'noStaticPath' };
          }
        });
      },
      (elseP) => complete(elseP, 'noStaticPath', {}),
    ) as StorageProgram<Result>;
  },

  sourceLocations(input: Record<string, unknown>) {
    const flow = input.flow as string;

    let p = createProgram();
    p = get(p, 'runtime-flow', flow, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          let steps: Array<Record<string, unknown>> = [];
          try {
            steps = JSON.parse(record.steps as string || '[]');
          } catch {
            return { locations: '[]' };
          }

          const locations: Array<Record<string, unknown>> = [];
          for (const step of steps) {
            locations.push({
              step: step.index,
              file: '',
              line: 0,
              col: 0,
              symbol: `${step.concept}/${step.action}`,
            });
          }

          return { locations: JSON.stringify(locations) };
        });
      },
      (elseP) => complete(elseP, 'ok', { locations: '[]' }),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const flow = input.flow as string;

    let p = createProgram();
    p = get(p, 'runtime-flow', flow, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            flow: record.id as string,
            flowId: record.flowId as string,
            status: record.status as string,
            stepCount: (record.stepCount as number) || 0,
            deviationCount: (record.deviationCount as number) || 0,
          };
        });
      },
      (elseP) => complete(elseP, 'notfound', {}),
    ) as StorageProgram<Result>;
  },
};

export const runtimeFlowHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetRuntimeFlowCounter(): void {
  idCounter = 0;
}
