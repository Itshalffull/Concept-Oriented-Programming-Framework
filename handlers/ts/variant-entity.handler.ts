// @clef-handler style=functional
// ============================================================
// VariantEntity Handler
//
// Action return variant as a first-class branching point in sync
// chains. Enables dead-variant detection and sync coverage analysis
// -- identifying variants that no sync pattern-matches on.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `variant-entity-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

/**
 * Count syncs matching a variant tag (pure helper).
 */
function countMatchingSyncs(allSyncs: Record<string, unknown>[], tag: string): number {
  let count = 0;
  for (const s of allSyncs) {
    try {
      const when = JSON.parse(s.whenPatterns as string || '[]');
      const matches = when.some((w: Record<string, unknown>) => {
        const outputFields = w.outputFields as Array<Record<string, unknown>> | undefined;
        if (!outputFields) return false;
        return outputFields.some((f) => {
          const match = f.match as Record<string, unknown>;
          return (
            match?.type === 'wildcard' ||
            (match?.type === 'literal' && match.value === tag)
          );
        });
      });
      if (matches) count++;
    } catch {
      // skip
    }
  }
  return count;
}

/**
 * Find syncs matching a given variant tag and action (pure helper).
 */
function filterMatchingSyncs(
  allSyncs: Record<string, unknown>[],
  tag: string,
  actionRef: string,
): Record<string, unknown>[] {
  return allSyncs.filter((s) => {
    try {
      const when = JSON.parse(s.whenPatterns as string || '[]');
      return when.some((w: Record<string, unknown>) => {
        const actionName = w.action as string;
        if (actionRef && !actionRef.includes(actionName)) return false;
        const outputFields = w.outputFields as Array<Record<string, unknown>> | undefined;
        if (!outputFields) return true;
        return outputFields.some((f) => {
          const match = f.match as Record<string, unknown>;
          return (
            match?.type === 'wildcard' ||
            (match?.type === 'literal' && match.value === tag)
          );
        });
      });
    } catch {
      return false;
    }
  });
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const action = input.action as string;
    const tag = input.tag as string;
    const fields = input.fields as string;

    if (!action || (typeof action === 'string' && action.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'action is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    const symbol = `clef/variant/${action}/${tag}`;

    let p = createProgram();
    p = put(p, 'variant-entity', id, {
      id, action, tag, symbol, fields, description: '',
    });
    return complete(p, 'ok', { variantRef: id, output: { variant: id } }) as StorageProgram<Result>;
  },

  matchingSyncs(input: Record<string, unknown>) {
    const variantId = input.variant as string;

    let p = createProgram();
    p = get(p, 'variant-entity', variantId, 'record');

    return branch(p,
      (b) => !b.record,
      (b) => complete(b, 'notfound', { variantId }) as StorageProgram<Result>,
      (b) => {
        let b2 = find(b, 'sync-entity', {}, 'allSyncs');
        return completeFrom(b2, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const allSyncs = bindings.allSyncs as Record<string, unknown>[];
          const matching = filterMatchingSyncs(allSyncs, record.tag as string, record.action as string);
          return { syncs: JSON.stringify(matching) };
        }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  isDead(input: Record<string, unknown>) {
    const variantId = input.variant as string;

    let p = createProgram();
    p = get(p, 'variant-entity', variantId, 'record');

    return branch(p,
      (b) => !b.record,
      (b) => complete(b, 'notfound', { message: 'Variant not found' }) as StorageProgram<Result>,
      (b) => {
        let b2 = find(b, 'sync-entity', {}, 'allSyncs');
        b2 = find(b2, 'runtime-coverage', {}, 'allCoverage');
        return completeFrom(b2, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const tag = record.tag as string;
          const symbol = record.symbol as string;
          const allSyncs = bindings.allSyncs as Record<string, unknown>[];
          const allCoverage = bindings.allCoverage as Record<string, unknown>[];
          const syncCount = countMatchingSyncs(allSyncs, tag);
          const runtimeCount = allCoverage.filter(c => c.symbol === symbol).length;
          const dead = syncCount === 0 && runtimeCount === 0;
          return { dead, syncCount, runtimeCount };
        }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const variantId = input.variant as string;

    let p = createProgram();
    p = get(p, 'variant-entity', variantId, 'record');

    return branch(p,
      (b) => !b.record,
      (b) => complete(b, 'notfound', {}) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          variantRef: record.id as string,
          action: record.action as string,
          tag: record.tag as string,
          fields: record.fields as string,
        };
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },
};

export const variantEntityHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetVariantEntityCounter(): void {
  idCounter = 0;
}
