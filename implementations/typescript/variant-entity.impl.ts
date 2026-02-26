// ============================================================
// VariantEntity Handler
//
// Action return variant as a first-class branching point in sync
// chains. Enables dead-variant detection and sync coverage analysis
// -- identifying variants that no sync pattern-matches on.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `variant-entity-${++idCounter}`;
}

export const variantEntityHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const action = input.action as string;
    const tag = input.tag as string;
    const fields = input.fields as string;

    const id = nextId();
    const symbol = `copf/variant/${action}/${tag}`;

    await storage.put('variant-entity', id, {
      id,
      action,
      tag,
      symbol,
      fields,
      description: '',
    });

    return { variant: 'ok', variantRef: id };
  },

  async matchingSyncs(input: Record<string, unknown>, storage: ConceptStorage) {
    const variantId = input.variant as string;

    const record = await storage.get('variant-entity', variantId);
    if (!record) {
      return { variant: 'ok', syncs: '[]' };
    }

    const tag = record.tag as string;
    const actionRef = record.action as string;

    // Search all syncs for when-patterns that match this variant's tag
    const allSyncs = await storage.find('sync-entity');
    const matching = allSyncs.filter((s) => {
      try {
        const when = JSON.parse(s.whenPatterns as string || '[]');
        return when.some((w: Record<string, unknown>) => {
          // Check if action matches
          const actionName = w.action as string;
          if (actionRef && !actionRef.includes(actionName)) return false;

          // Check if variant tag is matched in output fields
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

    return { variant: 'ok', syncs: JSON.stringify(matching) };
  },

  async isDead(input: Record<string, unknown>, storage: ConceptStorage) {
    const variantId = input.variant as string;

    const record = await storage.get('variant-entity', variantId);
    if (!record) {
      return { variant: 'dead', noMatchingSyncs: 'true', noRuntimeOccurrences: 'true' };
    }

    const tag = record.tag as string;
    const actionRef = record.action as string;

    // Check for matching syncs
    const allSyncs = await storage.find('sync-entity');
    let syncCount = 0;
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
        if (matches) syncCount++;
      } catch {
        // skip
      }
    }

    // Check for runtime occurrences
    const runtimeEntries = await storage.find('runtime-coverage', { symbol: record.symbol });
    const runtimeCount = runtimeEntries.length;

    if (syncCount === 0 || runtimeCount === 0) {
      return {
        variant: 'dead',
        noMatchingSyncs: syncCount === 0 ? 'true' : 'false',
        noRuntimeOccurrences: runtimeCount === 0 ? 'true' : 'false',
      };
    }

    return {
      variant: 'alive',
      syncCount,
      runtimeCount,
    };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const variantId = input.variant as string;

    const record = await storage.get('variant-entity', variantId);
    if (!record) {
      return { variant: 'notfound' };
    }

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
