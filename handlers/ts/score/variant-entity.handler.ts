// @clef-handler style=imperative
// ============================================================
// VariantEntity Concept Implementation (Functional)
//
// Action return variant as a first-class branching point in sync
// chains. Enables dead-variant detection and sync coverage analysis.
// Independent concept — sync/runtime cross-references populated
// by syncs.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, get, find, put, branch, complete, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const variantEntityHandler: FunctionalConceptHandler = {

  register(input) {
    const action = input.action as string;
    const tag = input.tag as string;
    const fields = input.fields as string;
    const id = crypto.randomUUID();
    const key = `variant:${action}/${tag}`;

    let p = createProgram();
    return complete(
      put(p, 'variant', key, {
        id,
        action,
        tag,
        symbol: `clef/variant/${action}/${tag}`,
        sourceFile: '',
        startLine: 0,
        fields: fields || '[]',
        description: '',
        // Populated by syncs from SyncEntity/register
        matchingSyncsCache: '[]',
        // Populated by syncs from RuntimeCoverage/record
        runtimeOccurrenceCount: 0,
      }),
      'ok', { variant: id },
    );
  },

  matchingSyncs(input) {
    const variantId = input.variant as string;

    let p = createProgram();
    p = find(p, 'variant', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(v => v.id === variantId);
      return entry ? (entry.matchingSyncsCache as string || '[]') : '[]';
    }, 'syncs');

    return pureFrom(p, (b) => ({ variant: 'ok', syncs: b.syncs }));
  },

  isDead(input) {
    const variantId = input.variant as string;

    let p = createProgram();
    p = find(p, 'variant', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(v => v.id === variantId);
      if (!entry) return { dead: true, syncCount: 0, runtimeCount: 0 };
      const syncs: unknown[] = JSON.parse(entry.matchingSyncsCache as string || '[]');
      const runtimeCount = (entry.runtimeOccurrenceCount as number) || 0;
      return { dead: syncs.length === 0 && runtimeCount === 0, syncCount: syncs.length, runtimeCount };
    }, 'analysis');

    return branch(p,
      (b) => (b.analysis as Record<string, unknown>).dead === true,
      pureFrom(createProgram(), (b) => {
        const a = b.analysis as Record<string, unknown>;
        return { variant: 'dead', noMatchingSyncs: 'true', noRuntimeOccurrences: 'true' };
      }),
      pureFrom(createProgram(), (b) => {
        const a = b.analysis as Record<string, unknown>;
        return { variant: 'alive', syncCount: a.syncCount, runtimeCount: a.runtimeCount };
      }),
    );
  },

  get(input) {
    const variantId = input.variant as string;

    let p = createProgram();
    p = find(p, 'variant', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.find(v => v.id === variantId) || null;
    }, 'entry');

    return branch(p,
      (b) => b.entry != null,
      pureFrom(createProgram(), (b) => {
        const e = b.entry as Record<string, unknown>;
        return { variant: 'ok', variant: e.id, action: e.action, tag: e.tag, fields: e.fields };
      }),
      complete(createProgram(), 'notfound', {}),
    );
  },
};
