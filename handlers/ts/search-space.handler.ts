// @migrated dsl-constructs 2026-03-18
// ============================================================
// SearchSpace Handler
//
// Scoped overlay indexes that layer on top of base search indexes.
// Enables version spaces, groups, and tenants to have independent
// search state without polluting shared indexes.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  index(input: Record<string, unknown>) {
    const scope_id = input.scope_id as string;
    const provider = input.provider as string;
    const entity_id = input.entity_id as string;
    const data = input.data as string;

    let p = createProgram();
    p = find(p, 'index_entries', {
      entry_scope: scope_id,
      entry_provider: provider,
      entry_entity_id: entity_id,
    }, 'existingEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const existingEntries = bindings.existingEntries as Record<string, unknown>[];

      if (existingEntries.length > 0) {
        return { entry: existingEntries[0].id as string };
      }

      const entryId = nextId('ssi');
      return { entry: entryId };
    }) as StorageProgram<Result>;
  },

  tombstone(input: Record<string, unknown>) {
    const scope_id = input.scope_id as string;
    const provider = input.provider as string;
    const entity_id = input.entity_id as string;

    let p = createProgram();
    p = find(p, 'index_entries', {
      entry_scope: scope_id,
      entry_provider: provider,
      entry_entity_id: entity_id,
    }, 'existingEntries');

    return completeFrom(p, 'ok', (bindings) => {
      const existingEntries = bindings.existingEntries as Record<string, unknown>[];

      if (existingEntries.length > 0) {
        return { entry: existingEntries[0].id as string };
      }

      const entryId = nextId('ssi');
      return { entry: entryId };
    }) as StorageProgram<Result>;
  },

  query(input: Record<string, unknown>) {
    const scope_id = input.scope_id as string;
    const provider = input.provider as string;
    const query_expr = input.query_expr as string;

    let p = createProgram();
    p = get(p, 'scopes', scope_id, 'scope');

    return branch(p, 'scope',
      (thenP) => {
        thenP = find(thenP, 'index_entries', {
          entry_scope: scope_id,
          entry_provider: provider,
        }, 'entries');

        return completeFrom(thenP, 'ok', (bindings) => {
          const entries = bindings.entries as Record<string, unknown>[];
          const scope = bindings.scope as Record<string, unknown>;

          const results: string[] = [];
          const tombstoned = new Set<string>();

          for (const entry of entries) {
            if (entry.entry_operation === 'tombstone') {
              tombstoned.add(entry.entry_entity_id as string);
            }
          }

          for (const entry of entries) {
            if (entry.entry_operation === 'index' &&
                !tombstoned.has(entry.entry_entity_id as string)) {
              const data = entry.entry_data as string;
              if (data.toLowerCase().includes(query_expr.toLowerCase())) {
                results.push(entry.entry_entity_id as string);
              }
            }
          }

          return { results };
        });
      },
      (elseP) => complete(elseP, 'no_scope', { scope_id }),
    ) as StorageProgram<Result>;
  },

  clear(input: Record<string, unknown>) {
    const scope_id = input.scope_id as string;

    let p = createProgram();
    p = del(p, 'scopes', scope_id);

    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },

  materialize(input: Record<string, unknown>) {
    const scope_id = input.scope_id as string;

    let p = createProgram();
    p = find(p, 'index_entries', { entry_scope: scope_id }, 'entries');

    return completeFrom(p, 'ok', (bindings) => {
      const entries = bindings.entries as Record<string, unknown>[];
      let count = 0;
      for (const entry of entries) {
        if (entry.entry_operation === 'index') {
          count++;
        }
      }
      return { count };
    }) as StorageProgram<Result>;
  },
};

export const searchSpaceHandler = autoInterpret(_handler);

export default searchSpaceHandler;
