// @clef-handler style=functional
// ============================================================
// SyncEntity Concept Implementation (Functional)
//
// Compiled sync rule as a queryable node — the semantic glue
// connecting concepts. Stores resolved when-patterns, where-clauses,
// and then-actions. Independent concept — only queries own storage.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, get, find, put, branch, complete, completeFrom, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const syncEntityHandler: FunctionalConceptHandler = {

  register(input) {
    const name = input.name as string;
    const source = input.source as string;
    const compiled = input.compiled as string;
    const id = crypto.randomUUID();
    const key = `sync:${name}`;
    const parsed = compiled ? JSON.parse(compiled) : {};

    let p = createProgram();
    p = get(p, 'sync', key, 'existing');

    return branch(p,
      (b) => b.existing != null,
      complete(createProgram(), 'alreadyRegistered', { existing: key }),
      complete(
        put(createProgram(), 'sync', key, {
          id,
          name,
          symbol: `clef/sync/${name}`,
          sourceFile: source,
          annotations: JSON.stringify(parsed.annotations || []),
          whenPatterns: JSON.stringify(parsed.when || []),
          whereClauses: JSON.stringify(parsed.where || []),
          thenActions: JSON.stringify(parsed.then || []),
          tier: parsed.tier || '',
        }),
        'ok', { sync: id },
      ),
    );
  },

  findByConcept(input) {
    const concept = input.concept as string;

    let p = createProgram();
    p = find(p, 'sync', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.filter(s => {
        const when: Array<{ concept?: string }> = JSON.parse(s.whenPatterns as string || '[]');
        const then: Array<{ concept?: string }> = JSON.parse(s.thenActions as string || '[]');
        return when.some(w => w.concept === concept) || then.some(t => t.concept === concept);
      });
    }, '_matching');

    return branch(p,
      (b) => {
        const all = b.all as unknown[];
        const matching = b._matching as unknown[];
        return all.length > 0 && matching.length === 0;
      },
      (b) => complete(b, 'notfound', { concept }),
      (b) => completeFrom(b, 'ok', (bindings) => ({
        syncs: JSON.stringify((bindings._matching as Array<Record<string, unknown>>).map(s => ({ id: s.id, name: s.name, tier: s.tier }))),
      })),
    );
  },

  findTriggerableBy(input) {
    const action = input.action as string;
    const variantFilter = input.variant as string;

    let p = createProgram();
    p = find(p, 'sync', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const matching = all.filter(s => {
        const when: Array<{ action?: string; variant?: string }> = JSON.parse(s.whenPatterns as string || '[]');
        return when.some(w =>
          w.action === action && (!variantFilter || !w.variant || w.variant === variantFilter),
        );
      });
      return JSON.stringify(matching.map(s => ({ id: s.id, name: s.name })));
    }, 'result');

    return completeFrom(p, 'ok', (b) => ({ syncs: b.result }));
  },

  chainFrom(input) {
    const action = input.action as string;
    const variantFilter = input.variant as string;
    const maxDepth = (input.depth as number) || 5;

    let p = createProgram();
    p = find(p, 'sync', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const chain: Array<Record<string, unknown>> = [];
      const visited = new Set<string>();

      let currentActions = [{ action, variant: variantFilter }];

      for (let depth = 0; depth < maxDepth && currentActions.length > 0; depth++) {
        const nextActions: Array<{ action: string; variant: string }> = [];

        for (const current of currentActions) {
          const triggered = all.filter(s => {
            const when: Array<{ action?: string; variant?: string }> = JSON.parse(s.whenPatterns as string || '[]');
            return when.some(w =>
              w.action === current.action &&
              (!current.variant || !w.variant || w.variant === current.variant),
            );
          });

          for (const sync of triggered) {
            if (visited.has(sync.name as string)) continue;
            visited.add(sync.name as string);

            const thenActions: Array<{ action?: string }> = JSON.parse(sync.thenActions as string || '[]');
            chain.push({ depth, sync: sync.name, triggeredBy: current.action, effects: thenActions });

            for (const effect of thenActions) {
              if (effect.action) nextActions.push({ action: effect.action, variant: '' });
            }
          }
        }
        currentActions = nextActions;
      }

      return chain;
    }, 'chain');

    return branch(p,
      (b) => (b.chain as unknown[]).length > 0,
      completeFrom(createProgram(), 'ok', (b) => ({ chain: JSON.stringify(b.chain) })),
      complete(createProgram(), 'noChain', {}),
    );
  },

  findDeadEnds(input) {
    let p = createProgram();
    p = find(p, 'sync', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;

      const deadEnds = all.filter(s => {
        const thenActions: Array<{ action?: string }> = JSON.parse(s.thenActions as string || '[]');
        if (thenActions.length === 0) return true;

        return thenActions.every(effect => {
          if (!effect.action) return true;
          return !all.some(other => {
            const when: Array<{ action?: string }> = JSON.parse(other.whenPatterns as string || '[]');
            return when.some(w => w.action === effect.action);
          });
        });
      });

      return JSON.stringify(deadEnds.map(s => ({ id: s.id, name: s.name, thenActions: s.thenActions })));
    }, 'deadEnds');

    return completeFrom(p, 'ok', (b) => ({ deadEnds: b.deadEnds }));
  },

  findOrphanVariants(input) {
    let p = createProgram();
    p = find(p, 'sync', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const matchedVariants = new Set<string>();
      for (const s of all) {
        const when: Array<{ action?: string; variant?: string }> = JSON.parse(s.whenPatterns as string || '[]');
        for (const w of when) {
          if (w.action && w.variant) matchedVariants.add(`${w.action}/${w.variant}`);
        }
      }
      return JSON.stringify(Array.from(matchedVariants));
    }, 'matched');

    // When storage has syncs but no cross-concept variant info available,
    // return error (variant cross-referencing requires ScoreApi, not own storage)
    return branch(p,
      (b) => (b.all as unknown[]).length > 0,
      (b) => complete(b, 'error', { message: 'Variant cross-referencing requires ScoreApi' }),
      (b) => complete(b, 'ok', { orphans: '[]' }),
    );
  },

  get(input) {
    const syncId = input.sync as string;

    let p = createProgram();
    p = find(p, 'sync', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.find(s => s.id === syncId || s.name === syncId) || null;
    }, 'entry');

    return branch(p,
      (b) => b.entry != null,
      completeFrom(createProgram(), 'ok', (b) => {
        const e = b.entry as Record<string, unknown>;
        const when: unknown[] = JSON.parse(e.whenPatterns as string || '[]');
        const then: unknown[] = JSON.parse(e.thenActions as string || '[]');
        return {
          sync: e.id, name: e.name,
          annotations: e.annotations, tier: e.tier,
          whenPatternCount: when.length, thenActionCount: then.length,
        };
      }),
      complete(createProgram(), 'notfound', {}),
    );
  },
};
