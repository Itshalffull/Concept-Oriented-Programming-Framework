// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// ============================================================
// VariantEntity Handler
//
// Action return variant as a first-class branching point in sync
// chains. Enables dead-variant detection and sync coverage analysis
// -- identifying variants that no sync pattern-matches on.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `variant-entity-${++idCounter}`;
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

export const variantEntityHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const action = input.action as string;
    const tag = input.tag as string;
    const fields = input.fields as string;

    const id = nextId();
    const symbol = `clef/variant/${action}/${tag}`;

    await storage.put('variant-entity', id, {
      id, action, tag, symbol, fields, description: '',
    });

    return { variant: 'ok', variantRef: id };
  },

  async matchingSyncs(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const variantId = input.variant as string;
    const record = await storage.get('variant-entity', variantId);
    if (!record) return { variant: 'ok', syncs: '[]' };

    const allSyncs = await storage.find('sync-entity', {});
    const tag = record.tag as string;
    const actionRef = record.action as string;
    const matching = filterMatchingSyncs(allSyncs, tag, actionRef);
    return { variant: 'ok', syncs: JSON.stringify(matching) };
  },

  async isDead(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const variantId = input.variant as string;
    const record = await storage.get('variant-entity', variantId);
    if (!record) return { variant: 'dead', noMatchingSyncs: 'true', noRuntimeOccurrences: 'true' };

    const tag = record.tag as string;
    const symbol = record.symbol as string;
    const allSyncs = await storage.find('sync-entity', {});
    const syncCount = countMatchingSyncs(allSyncs, tag);

    // Check runtime coverage
    const runtimeCoverage = await storage.find('runtime-coverage', { symbol });
    const runtimeCount = runtimeCoverage.length;

    if (syncCount === 0 && runtimeCount === 0) {
      return { variant: 'dead', noMatchingSyncs: 'true', noRuntimeOccurrences: 'true' };
    }
    if (syncCount > 0 && runtimeCount === 0) {
      return { variant: 'dead', noMatchingSyncs: 'false', noRuntimeOccurrences: 'true' };
    }
    return { variant: 'alive', syncCount, runtimeCount };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const variantId = input.variant as string;
    const record = await storage.get('variant-entity', variantId);
    if (!record) return { variant: 'notfound' };
    return {
      variant: 'ok',
      variantRef: record.id as string,
      action: record.action as string,
      tag: record.tag as string,
      fields: record.fields as string,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetVariantEntityCounter(): void {
  idCounter = 0;
}
