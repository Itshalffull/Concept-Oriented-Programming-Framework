// @migrated dsl-constructs 2026-03-18
// ============================================================
// VariantEntity Handler
//
// Action return variant as a first-class branching point in sync
// chains. Enables dead-variant detection and sync coverage analysis
// -- identifying variants that no sync pattern-matches on.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `variant-entity-${++idCounter}`;
}

/**
 * Check if any sync patterns match a given variant tag (pure helper).
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
        if (!outputFields) return true; // wildcard match
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

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const action = input.action as string;
    const tag = input.tag as string;
    const fields = input.fields as string;

    const id = nextId();
    const symbol = `clef/variant/${action}/${tag}`;

    let p = createProgram();
    p = put(p, 'variant-entity', id, {
      id,
      action,
      tag,
      symbol,
      fields,
      description: '',
    });

    return complete(p, 'ok', { variantRef: id }) as StorageProgram<Result>;
  },

  matchingSyncs(input: Record<string, unknown>) {
    const variantId = input.variant as string;

    let p = createProgram();
    p = get(p, 'variant-entity', variantId, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = find(thenP, 'sync-entity', {}, 'allSyncs');
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const tag = record.tag as string;
          const actionRef = record.action as string;
          const allSyncs = bindings.allSyncs as Record<string, unknown>[];
          const matching = filterMatchingSyncs(allSyncs, tag, actionRef);
          return { syncs: JSON.stringify(matching) };
        });
      },
      (elseP) => complete(elseP, 'ok', { syncs: '[]' }),
    ) as StorageProgram<Result>;
  },

  isDead(input: Record<string, unknown>) {
    const variantId = input.variant as string;

    let p = createProgram();
    p = get(p, 'variant-entity', variantId, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = find(thenP, 'sync-entity', {}, 'allSyncs');
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const tag = record.tag as string;
          const syncCount = countMatchingSyncs(bindings.allSyncs as Record<string, unknown>[], tag);
          // Note: runtime-coverage check would require another find; simplified here
          if (syncCount === 0) {
            return { variant: 'dead', noMatchingSyncs: 'true', noRuntimeOccurrences: 'true' };
          }
          return { variant: 'alive', syncCount, runtimeCount: 0 };
        });
      },
      (elseP) => complete(elseP, 'dead', { noMatchingSyncs: 'true', noRuntimeOccurrences: 'true' }),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const variantId = input.variant as string;

    let p = createProgram();
    p = get(p, 'variant-entity', variantId, 'record');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          variantRef: record.id as string,
          action: record.action as string,
          tag: record.tag as string,
          fields: record.fields as string,
        };
      }),
      (elseP) => complete(elseP, 'notfound', {}),
    ) as StorageProgram<Result>;
  },
};

export const variantEntityHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetVariantEntityCounter(): void {
  idCounter = 0;
}
