// ============================================================
// SyncEntity Handler
//
// Compiled sync rule as a queryable node -- the semantic glue
// connecting concepts. Stores resolved when-patterns, where-clauses,
// and then-actions with full concept/action references. Enables
// flow tracing, dead-end detection, and orphan variant analysis.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `sync-entity-${++idCounter}`;
}

export const syncEntityHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const source = input.source as string;
    const compiled = input.compiled as string;

    // Check for duplicate by name
    const existing = await storage.find('sync-entity', { name });
    if (existing.length > 0) {
      return { variant: 'alreadyRegistered', existing: existing[0].id as string };
    }

    const id = nextId();
    const symbol = `copf/sync/${name}`;

    // Extract metadata from compiled payload
    let annotations = '[]';
    let whenPatterns = '[]';
    let whereClauses = '[]';
    let thenActions = '[]';
    let tier = 'standard';
    let whenPatternCount = 0;
    let thenActionCount = 0;

    try {
      const parsed = JSON.parse(compiled);
      annotations = JSON.stringify(parsed.annotations || []);
      whenPatterns = JSON.stringify(parsed.when || []);
      whereClauses = JSON.stringify(parsed.where || []);
      thenActions = JSON.stringify(parsed.then || []);
      tier = parsed.tier || 'standard';
      whenPatternCount = (parsed.when || []).length;
      thenActionCount = (parsed.then || []).length;
    } catch {
      // compiled may be empty or non-JSON; store defaults
    }

    await storage.put('sync-entity', id, {
      id,
      name,
      symbol,
      sourceFile: source,
      compiled,
      annotations,
      whenPatterns,
      whereClauses,
      thenActions,
      tier,
      whenPatternCount,
      thenActionCount,
    });

    return { variant: 'ok', sync: id };
  },

  async findByConcept(input: Record<string, unknown>, storage: ConceptStorage) {
    const concept = input.concept as string;

    const allSyncs = await storage.find('sync-entity');
    const matching = allSyncs.filter((s) => {
      try {
        const when = JSON.parse(s.whenPatterns as string || '[]');
        const then = JSON.parse(s.thenActions as string || '[]');
        const whenMatch = when.some((w: Record<string, unknown>) => w.concept === concept);
        const thenMatch = then.some((t: Record<string, unknown>) => t.concept === concept);
        return whenMatch || thenMatch;
      } catch {
        return false;
      }
    });

    return { variant: 'ok', syncs: JSON.stringify(matching) };
  },

  async findTriggerableBy(input: Record<string, unknown>, storage: ConceptStorage) {
    const action = input.action as string;
    const variantFilter = input.variant as string;

    const allSyncs = await storage.find('sync-entity');
    const matching = allSyncs.filter((s) => {
      try {
        const when = JSON.parse(s.whenPatterns as string || '[]');
        return when.some((w: Record<string, unknown>) => {
          const actionMatch = w.action === action;
          if (!actionMatch) return false;
          if (variantFilter && variantFilter !== '') {
            // Check if pattern matches this variant
            const outputFields = w.outputFields as Array<Record<string, unknown>> | undefined;
            if (outputFields) {
              return outputFields.some(
                (f) =>
                  f.name === 'variant' &&
                  ((f.match as Record<string, unknown>)?.type === 'wildcard' ||
                    (f.match as Record<string, unknown>)?.value === variantFilter),
              );
            }
          }
          return true;
        });
      } catch {
        return false;
      }
    });

    return { variant: 'ok', syncs: JSON.stringify(matching) };
  },

  async chainFrom(input: Record<string, unknown>, storage: ConceptStorage) {
    const action = input.action as string;
    const variantFilter = input.variant as string;
    const depth = input.depth as number;

    const allSyncs = await storage.find('sync-entity');

    // Build chain by following when -> then -> when links
    const chain: Array<Record<string, unknown>> = [];
    let currentActions = [{ action, variant: variantFilter }];

    for (let d = 0; d < depth && currentActions.length > 0; d++) {
      const nextActions: Array<{ action: string; variant: string }> = [];

      for (const current of currentActions) {
        const triggered = allSyncs.filter((s) => {
          try {
            const when = JSON.parse(s.whenPatterns as string || '[]');
            return when.some((w: Record<string, unknown>) => w.action === current.action);
          } catch {
            return false;
          }
        });

        for (const sync of triggered) {
          try {
            const then = JSON.parse(sync.thenActions as string || '[]');
            for (const t of then) {
              const thenAction = t as Record<string, unknown>;
              chain.push({
                depth: d,
                sync: sync.name,
                triggerAction: current.action,
                thenConcept: thenAction.concept,
                thenAction: thenAction.action,
              });
              nextActions.push({
                action: thenAction.action as string,
                variant: '',
              });
            }
          } catch {
            // skip malformed
          }
        }
      }

      currentActions = nextActions;
    }

    if (chain.length === 0) {
      return { variant: 'noChain' };
    }

    return { variant: 'ok', chain: JSON.stringify(chain) };
  },

  async findDeadEnds(_input: Record<string, unknown>, storage: ConceptStorage) {
    const allSyncs = await storage.find('sync-entity');

    // Collect all action names referenced in when-patterns
    const triggeredActions = new Set<string>();
    for (const s of allSyncs) {
      try {
        const when = JSON.parse(s.whenPatterns as string || '[]');
        for (const w of when) {
          triggeredActions.add((w as Record<string, unknown>).action as string);
        }
      } catch {
        // skip
      }
    }

    // Find syncs whose then-actions are not triggered by any other sync
    const deadEnds = allSyncs.filter((s) => {
      try {
        const then = JSON.parse(s.thenActions as string || '[]');
        return then.every((t: Record<string, unknown>) => !triggeredActions.has(t.action as string));
      } catch {
        return false;
      }
    });

    return { variant: 'ok', deadEnds: JSON.stringify(deadEnds) };
  },

  async findOrphanVariants(_input: Record<string, unknown>, storage: ConceptStorage) {
    const allSyncs = await storage.find('sync-entity');
    const allVariants = await storage.find('variant-entity');

    // Collect all variant tags matched in when-patterns
    const matchedTags = new Set<string>();
    for (const s of allSyncs) {
      try {
        const when = JSON.parse(s.whenPatterns as string || '[]');
        for (const w of when) {
          const outputFields = (w as Record<string, unknown>).outputFields as
            | Array<Record<string, unknown>>
            | undefined;
          if (outputFields) {
            for (const f of outputFields) {
              if (f.name === 'variant') {
                const match = f.match as Record<string, unknown>;
                if (match?.type === 'literal' && match.value) {
                  matchedTags.add(match.value as string);
                }
              }
            }
          }
        }
      } catch {
        // skip
      }
    }

    // Find variants not matched by any sync
    const orphans = allVariants.filter((v) => !matchedTags.has(v.tag as string));

    return { variant: 'ok', orphans: JSON.stringify(orphans) };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const sync = input.sync as string;

    const record = await storage.get('sync-entity', sync);
    if (!record) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      sync: record.id as string,
      name: record.name as string,
      annotations: record.annotations as string,
      tier: record.tier as string,
      whenPatternCount: (record.whenPatternCount as number) || 0,
      thenActionCount: (record.thenActionCount as number) || 0,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSyncEntityCounter(): void {
  idCounter = 0;
}
