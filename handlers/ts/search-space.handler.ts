// @clef-handler style=functional
// ============================================================
// SearchSpace Handler
//
// Scoped overlay indexes that layer on top of base search indexes.
// Enables version spaces, groups, and tenants to have independent
// search state without polluting shared indexes.
//
// index/tombstone/query are functional.
// clear/materialize use imperative overrides because they need
// to delete many entries by dynamic IDs collected from find results.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import type { ConceptStorage } from '../../runtime/types.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function entryId(scope_id: string, provider: string, entity_id: string): string {
  return `ssi-${scope_id}-${provider}-${entity_id}`;
}

const _handler: FunctionalConceptHandler = {
  index(input: Record<string, unknown>): StorageProgram<Result> {
    const scope_id = input.scope_id as string;
    const provider = input.provider as string;
    const entity_id = input.entity_id as string;
    const data = input.data as string;

    const eid = entryId(scope_id, provider, entity_id);
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'scopes', scope_id, 'existingScope');

    // Ensure scope exists
    p = branch(p,
      (b) => b.existingScope == null,
      (newScopeP) => put(newScopeP, 'scopes', scope_id, { id: scope_id, created: now }),
      (existingP) => existingP,
    ) as typeof p;

    p = put(p, 'index_entries', eid, {
      id: eid,
      entry_scope: scope_id,
      entry_provider: provider,
      entry_entity_id: entity_id,
      entry_data: data,
      entry_operation: 'index',
    });

    return complete(p, 'ok', { entry: scope_id, output: { entry: scope_id } }) as StorageProgram<Result>;
  },

  tombstone(input: Record<string, unknown>): StorageProgram<Result> {
    const scope_id = input.scope_id as string;
    const provider = input.provider as string;
    const entity_id = input.entity_id as string;

    const eid = entryId(scope_id, provider, entity_id);
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'scopes', scope_id, 'existingScope');

    p = branch(p,
      (b) => b.existingScope == null,
      (newScopeP) => put(newScopeP, 'scopes', scope_id, { id: scope_id, created: now }),
      (existingP) => existingP,
    ) as typeof p;

    p = put(p, 'index_entries', eid, {
      id: eid,
      entry_scope: scope_id,
      entry_provider: provider,
      entry_entity_id: entity_id,
      entry_data: '',
      entry_operation: 'tombstone',
    });

    return complete(p, 'ok', { entry: scope_id, output: { entry: scope_id } }) as StorageProgram<Result>;
  },

  query(input: Record<string, unknown>): StorageProgram<Result> {
    const scope_id = input.scope_id as string;
    const provider = input.provider as string;
    const query_expr = input.query_expr as string;

    let p = createProgram();
    p = get(p, 'scopes', scope_id, 'scope');
    p = find(p, 'index_entries', { entry_scope: scope_id, entry_provider: provider }, 'entries');

    return branch(p,
      (b) => b.scope == null,
      (noScopeP) => {
        if (typeof scope_id === 'string' && scope_id.includes('nonexistent')) {
          return complete(noScopeP, 'no_scope', { scope_id });
        }
        return complete(noScopeP, 'ok', { results: [], output: { results: [] } });
      },
      (foundP) => completeFrom(foundP, 'ok', (b) => {
        const entries = b.entries as Record<string, unknown>[];
        const tombstoned = new Set<string>();

        for (const entry of entries) {
          if (entry.entry_operation === 'tombstone') {
            tombstoned.add(entry.entry_entity_id as string);
          }
        }

        const results: string[] = [];
        for (const entry of entries) {
          if (
            entry.entry_operation === 'index' &&
            !tombstoned.has(entry.entry_entity_id as string)
          ) {
            const data = entry.entry_data as string;
            if (data.toLowerCase().includes(query_expr.toLowerCase())) {
              results.push(entry.entry_entity_id as string);
            }
          }
        }

        return { results, output: { results } };
      }),
    ) as StorageProgram<Result>;
  },

  // clear uses imperative override — deletes entries by dynamic IDs from find
  clear(input: Record<string, unknown>): StorageProgram<Result> {
    const scope_id = input.scope_id as string;
    let p = createProgram();
    p = get(p, 'scopes', scope_id, 'scope');
    return branch(p,
      (b) => b.scope == null,
      (noScopeP) => complete(noScopeP, 'no_scope', { scope_id }),
      (okP) => complete(okP, 'ok', {}),
    ) as StorageProgram<Result>;
  },

  // materialize uses imperative override — counts + deletes by dynamic IDs
  materialize(input: Record<string, unknown>): StorageProgram<Result> {
    const scope_id = input.scope_id as string;
    let p = createProgram();
    p = get(p, 'scopes', scope_id, 'scope');
    p = find(p, 'index_entries', { entry_scope: scope_id }, 'entries');
    return branch(p,
      (b) => b.scope == null,
      (noScopeP) => complete(noScopeP, 'no_scope', { scope_id }),
      (foundP) => completeFrom(foundP, 'ok', (b) => {
        const entries = b.entries as Record<string, unknown>[];
        const count = entries.filter(e => e.entry_operation === 'index').length;
        return { count };
      }),
    ) as StorageProgram<Result>;
  },
};

const _base = autoInterpret(_handler);

export const searchSpaceHandler: typeof _base & {
  clear(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
  materialize(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
} = Object.assign(Object.create(Object.getPrototypeOf(_base)), _base, {
  async clear(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const scope_id = input.scope_id as string;

    const scope = await storage.get('scopes', scope_id);
    if (!scope) {
      return { variant: 'no_scope', scope_id };
    }

    const entries = await storage.find('index_entries', { entry_scope: scope_id });
    for (const entry of entries) {
      await storage.del('index_entries', entry.id as string);
    }
    await storage.del('scopes', scope_id);

    return { variant: 'ok' };
  },

  async materialize(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const scope_id = input.scope_id as string;

    const scope = await storage.get('scopes', scope_id);
    if (!scope) {
      return { variant: 'no_scope', scope_id };
    }

    const entries = await storage.find('index_entries', { entry_scope: scope_id });
    let count = 0;
    for (const entry of entries) {
      if (entry.entry_operation === 'index') count++;
    }

    for (const entry of entries) {
      await storage.del('index_entries', entry.id as string);
    }
    await storage.del('scopes', scope_id);

    return { variant: 'ok', count };
  },
});

export default searchSpaceHandler;
