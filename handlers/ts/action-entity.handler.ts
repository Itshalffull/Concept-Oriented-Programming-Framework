// @migrated dsl-constructs 2026-03-18
// ============================================================
// ActionEntity Handler
//
// Action declaration with full lifecycle tracing from spec through
// sync participation, implementation, interface exposure, to
// runtime invocation. Enables queries like "what syncs trigger on
// this action?" and "where is this action implemented?"
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `action-entity-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

/**
 * Parse variant refs to get count. Pure helper.
 */
function countVariants(variantRefs: string): number {
  try {
    const parsed = JSON.parse(variantRefs);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Filter syncs whose compiled whenPatterns reference a given concept+action. Pure helper.
 */
function filterSyncsByWhen(
  allSyncs: Record<string, unknown>[],
  concept: string,
  actionName: string,
): Record<string, unknown>[] {
  return allSyncs.filter((s) => {
    try {
      const compiled = JSON.parse(s.compiled as string || '{}');
      const whenPatterns = compiled.when || [];
      return whenPatterns.some(
        (w: Record<string, unknown>) =>
          w.concept === concept && w.action === actionName,
      );
    } catch {
      return false;
    }
  });
}

/**
 * Filter syncs whose compiled thenActions reference a given concept+action. Pure helper.
 */
function filterSyncsByThen(
  allSyncs: Record<string, unknown>[],
  concept: string,
  actionName: string,
): Record<string, unknown>[] {
  return allSyncs.filter((s) => {
    try {
      const compiled = JSON.parse(s.compiled as string || '{}');
      const thenActions = compiled.then || [];
      return thenActions.some(
        (t: Record<string, unknown>) =>
          t.concept === concept && t.action === actionName,
      );
    } catch {
      return false;
    }
  });
}

const _actionEntityHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const name = input.name as string;
    const params = input.params as string;
    const variantRefs = input.variantRefs as string;

    let p = createProgram();
    p = find(p, 'action-entity', { concept, name }, 'existing');

    p = branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (b) => completeFrom(b, 'ok', (bindings) => ({
        action: ((bindings.existing as Record<string, unknown>[])[0].id as string),
      })) as StorageProgram<Result>,
      (b) => {
        const id = nextId();
        const symbol = `clef/action/${concept}/${name}`;
        const variantCount = countVariants(variantRefs);

        let b2 = put(b, 'action-entity', id, {
          id,
          concept,
          name,
          symbol,
          params,
          variantRefs,
          variantCount,
          implementationSymbols: '[]',
        });
        return complete(b2, 'ok', { action: id }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;

    return p;
  },

  findByConcept(input: Record<string, unknown>) {
    const concept = input.concept as string;

    const criteria: Record<string, unknown> = {};
    if (concept !== undefined && concept !== '') criteria.concept = concept;

    let p = createProgram();
    p = find(p, 'action-entity', Object.keys(criteria).length > 0 ? criteria : {}, 'results');
    return completeFrom(p, 'ok', (bindings) => ({
      actions: JSON.stringify(bindings.results),
    })) as StorageProgram<Result>;
  },

  triggeringSyncs(input: Record<string, unknown>) {
    const action = input.action as string;

    let p = createProgram();
    p = get(p, 'action-entity', action, 'actionRecord');

    p = branch(p, 'actionRecord',
      (b) => {
        let b2 = find(b, 'sync-entity', {}, 'allSyncs');
        return completeFrom(b2, 'ok', (bindings) => {
          const actionRecord = bindings.actionRecord as Record<string, unknown>;
          const allSyncs = bindings.allSyncs as Record<string, unknown>[];
          const matching = filterSyncsByWhen(allSyncs, actionRecord.concept as string, actionRecord.name as string);
          return { syncs: JSON.stringify(matching) };
        }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'ok', { syncs: '[]' }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;

    return p;
  },

  invokingSyncs(input: Record<string, unknown>) {
    const action = input.action as string;

    let p = createProgram();
    p = get(p, 'action-entity', action, 'actionRecord');

    p = branch(p, 'actionRecord',
      (b) => {
        let b2 = find(b, 'sync-entity', {}, 'allSyncs');
        return completeFrom(b2, 'ok', (bindings) => {
          const actionRecord = bindings.actionRecord as Record<string, unknown>;
          const allSyncs = bindings.allSyncs as Record<string, unknown>[];
          const matching = filterSyncsByThen(allSyncs, actionRecord.concept as string, actionRecord.name as string);
          return { syncs: JSON.stringify(matching) };
        }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'ok', { syncs: '[]' }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;

    return p;
  },

  implementations(input: Record<string, unknown>) {
    const action = input.action as string;

    let p = createProgram();
    p = get(p, 'action-entity', action, 'record');

    return completeFrom(p, 'ok', (bindings) => {
      const record = bindings.record as Record<string, unknown> | null;
      if (!record) return { symbols: '[]' };
      return { symbols: (record.implementationSymbols as string) || '[]' };
    }) as StorageProgram<Result>;
  },

  interfaceExposures(input: Record<string, unknown>) {
    const action = input.action as string;

    let p = createProgram();
    p = get(p, 'action-entity', action, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return record.symbol as string;
        }, 'actionSymbol');
        b2 = find(b2, 'interface-exposure', {}, 'allExposures');
        return completeFrom(b2, 'ok', (bindings) => {
          const actionSymbol = bindings.actionSymbol as string;
          const allExposures = bindings.allExposures as Record<string, unknown>[];
          const matching = allExposures.filter(e => e.actionSymbol === actionSymbol);
          return { exposures: JSON.stringify(matching) };
        }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'ok', { exposures: '[]' }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;

    return p;
  },

  get(input: Record<string, unknown>) {
    const action = input.action as string;

    let p = createProgram();
    p = get(p, 'action-entity', action, 'record');

    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          action: record.id as string,
          concept: record.concept as string,
          name: record.name as string,
          params: record.params as string,
          variantCount: (record.variantCount as number) || 0,
        };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', {}) as StorageProgram<Result>,
    ) as StorageProgram<Result>;

    return p;
  },
};

export const actionEntityHandler = autoInterpret(_actionEntityHandler);

/** Reset the ID counter. Useful for testing. */
export function resetActionEntityCounter(): void {
  idCounter = 0;
}
