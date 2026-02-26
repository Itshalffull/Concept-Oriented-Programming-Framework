// ============================================================
// RuntimeFlow Handler
//
// Enriched execution flow that correlates ActionLog events with
// static semantic entities -- the resolved version of FlowTrace.
// Enables comparing actual runtime paths against static FlowGraph
// predictions to find deviations, missing syncs, and unexpected
// branches.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `runtime-flow-${++idCounter}`;
}

export const runtimeFlowHandler: ConceptHandler = {
  async correlate(input: Record<string, unknown>, storage: ConceptStorage) {
    const flowId = input.flowId as string;

    // Look up ActionLog entries for this flow
    const logEntries = await storage.find('action-log', { flow: flowId });
    if (logEntries.length === 0) {
      return { variant: 'notfound' };
    }

    const id = nextId();
    const now = new Date().toISOString();
    const unresolved: Array<Record<string, unknown>> = [];

    // Build enriched steps by resolving each log entry to static entities
    const steps: Array<Record<string, unknown>> = [];
    let trigger = '';
    let hasError = false;

    for (const entry of logEntries) {
      const concept = entry.concept as string || '';
      const action = entry.action as string || '';
      const variantName = entry.variant as string || '';

      // Resolve to static semantic entities
      let conceptEntityId = '';
      let actionEntityId = '';
      let variantEntityId = '';
      let syncEntityId = '';

      if (concept) {
        const conceptResults = await storage.find('concept-entity', { name: concept });
        if (conceptResults.length > 0) {
          conceptEntityId = conceptResults[0].id as string;
        } else {
          unresolved.push({ type: 'concept', name: concept });
        }
      }

      if (concept && action) {
        const actionResults = await storage.find('action-entity', { concept, name: action });
        if (actionResults.length > 0) {
          actionEntityId = actionResults[0].id as string;
        } else {
          unresolved.push({ type: 'action', name: `${concept}/${action}` });
        }
      }

      if (variantName && concept && action) {
        const variantResults = await storage.find('variant-entity', {
          action: `${concept}/${action}`,
          tag: variantName,
        });
        if (variantResults.length > 0) {
          variantEntityId = variantResults[0].id as string;
        }
      }

      if (entry.sync) {
        const syncResults = await storage.find('sync-entity', { name: entry.sync });
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

    // Compute expected path from static FlowGraph
    let expectedPath = '[]';
    let deviations = '[]';
    let deviationCount = 0;

    // Look up static flow graph for the trigger action
    const flowGraphEntries = await storage.find('flow-graph', { trigger });
    if (flowGraphEntries.length > 0) {
      try {
        expectedPath = flowGraphEntries[0].path as string || '[]';
        const expected = JSON.parse(expectedPath);

        // Compare actual steps with expected path
        const devs: Array<Record<string, unknown>> = [];
        for (let i = 0; i < Math.max(steps.length, expected.length); i++) {
          const actual = steps[i];
          const exp = expected[i];
          if (!actual && exp) {
            devs.push({ step: i, expected: exp, actual: null });
          } else if (actual && !exp) {
            devs.push({ step: i, expected: null, actual: { concept: actual.concept, action: actual.action } });
          } else if (actual && exp) {
            if (actual.concept !== exp.concept || actual.action !== exp.action) {
              devs.push({
                step: i,
                expected: { concept: exp.concept, action: exp.action },
                actual: { concept: actual.concept, action: actual.action },
              });
            }
          }
        }
        deviations = JSON.stringify(devs);
        deviationCount = devs.length;
      } catch {
        // skip
      }
    }

    const status = hasError ? 'failed' : 'completed';

    // Find start and end timestamps
    const startedAt = steps.length > 0 ? (steps[0].timestamp as string) || now : now;
    const completedAt = steps.length > 0 ? (steps[steps.length - 1].timestamp as string) || now : now;

    await storage.put('runtime-flow', id, {
      id,
      flowId,
      startedAt,
      completedAt,
      status,
      trigger,
      steps: JSON.stringify(steps),
      expectedPath,
      deviations,
      stepCount: steps.length,
      deviationCount,
    });

    if (unresolved.length > 0) {
      return { variant: 'partial', flow: id, unresolved: JSON.stringify(unresolved) };
    }

    return { variant: 'ok', flow: id };
  },

  async findByAction(input: Record<string, unknown>, storage: ConceptStorage) {
    const action = input.action as string;
    const since = input.since as string;

    const allFlows = await storage.find('runtime-flow');
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

    return { variant: 'ok', flows: JSON.stringify(matching) };
  },

  async findBySync(input: Record<string, unknown>, storage: ConceptStorage) {
    const sync = input.sync as string;
    const since = input.since as string;

    const allFlows = await storage.find('runtime-flow');
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

    return { variant: 'ok', flows: JSON.stringify(matching) };
  },

  async findByVariant(input: Record<string, unknown>, storage: ConceptStorage) {
    const variantFilter = input.variant as string;
    const since = input.since as string;

    const allFlows = await storage.find('runtime-flow');
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

    return { variant: 'ok', flows: JSON.stringify(matching) };
  },

  async findFailures(input: Record<string, unknown>, storage: ConceptStorage) {
    const since = input.since as string;

    const allFlows = await storage.find('runtime-flow');
    const failures = allFlows.filter((f) => {
      const status = f.status as string;
      if (status !== 'failed' && status !== 'timeout') return false;

      if (since && since !== '') {
        return (f.startedAt as string) >= since;
      }
      return true;
    });

    return { variant: 'ok', flows: JSON.stringify(failures) };
  },

  async compareToStatic(input: Record<string, unknown>, storage: ConceptStorage) {
    const flow = input.flow as string;

    const record = await storage.get('runtime-flow', flow);
    if (!record) {
      return { variant: 'noStaticPath' };
    }

    const trigger = record.trigger as string;

    // Look up expected static path
    const flowGraphEntries = await storage.find('flow-graph', { trigger });
    if (flowGraphEntries.length === 0) {
      return { variant: 'noStaticPath' };
    }

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
  },

  async sourceLocations(input: Record<string, unknown>, storage: ConceptStorage) {
    const flow = input.flow as string;

    const record = await storage.get('runtime-flow', flow);
    if (!record) {
      return { variant: 'ok', locations: '[]' };
    }

    let steps: Array<Record<string, unknown>> = [];
    try {
      steps = JSON.parse(record.steps as string || '[]');
    } catch {
      return { variant: 'ok', locations: '[]' };
    }

    const locations: Array<Record<string, unknown>> = [];
    for (const step of steps) {
      // Look up source location from the concept/action entity
      const actionEntityId = step.actionEntity as string;
      let file = '';
      let line = 0;
      let col = 0;
      let symbol = '';

      if (actionEntityId) {
        const actionRecord = await storage.get('action-entity', actionEntityId);
        if (actionRecord) {
          symbol = actionRecord.symbol as string || '';
          // Look up source mapping
          const sourceMap = await storage.find('source-map', { symbol });
          if (sourceMap.length > 0) {
            file = sourceMap[0].file as string || '';
            line = (sourceMap[0].line as number) || 0;
            col = (sourceMap[0].col as number) || 0;
          }
        }
      }

      locations.push({
        step: step.index,
        file,
        line,
        col,
        symbol: symbol || `${step.concept}/${step.action}`,
      });
    }

    return { variant: 'ok', locations: JSON.stringify(locations) };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const flow = input.flow as string;

    const record = await storage.get('runtime-flow', flow);
    if (!record) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      flow: record.id as string,
      flowId: record.flowId as string,
      status: record.status as string,
      stepCount: (record.stepCount as number) || 0,
      deviationCount: (record.deviationCount as number) || 0,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetRuntimeFlowCounter(): void {
  idCounter = 0;
}
