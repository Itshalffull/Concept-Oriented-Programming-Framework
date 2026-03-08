// SearchSpace — Scoped overlay indexes that layer on top of base search indexes.
// Enables version spaces, groups, and tenants to have independent search state
// without polluting shared indexes.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SearchSpaceStorage,
  SearchSpaceIndexInput,
  SearchSpaceIndexOutput,
  SearchSpaceTombstoneInput,
  SearchSpaceTombstoneOutput,
  SearchSpaceQueryInput,
  SearchSpaceQueryOutput,
  SearchSpaceClearInput,
  SearchSpaceClearOutput,
  SearchSpaceMaterializeInput,
  SearchSpaceMaterializeOutput,
} from './types.js';

import {
  indexOk,
  tombstoneOk,
  queryOk,
  queryNoScope,
  clearOk,
  materializeOk,
} from './types.js';

export interface SearchSpaceError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): SearchSpaceError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

let idCounter = 0;
const nextId = (prefix: string): string => `${prefix}-${++idCounter}`;

export interface SearchSpaceHandler {
  readonly index: (
    input: SearchSpaceIndexInput,
    storage: SearchSpaceStorage,
  ) => TE.TaskEither<SearchSpaceError, SearchSpaceIndexOutput>;
  readonly tombstone: (
    input: SearchSpaceTombstoneInput,
    storage: SearchSpaceStorage,
  ) => TE.TaskEither<SearchSpaceError, SearchSpaceTombstoneOutput>;
  readonly query: (
    input: SearchSpaceQueryInput,
    storage: SearchSpaceStorage,
  ) => TE.TaskEither<SearchSpaceError, SearchSpaceQueryOutput>;
  readonly clear: (
    input: SearchSpaceClearInput,
    storage: SearchSpaceStorage,
  ) => TE.TaskEither<SearchSpaceError, SearchSpaceClearOutput>;
  readonly materialize: (
    input: SearchSpaceMaterializeInput,
    storage: SearchSpaceStorage,
  ) => TE.TaskEither<SearchSpaceError, SearchSpaceMaterializeOutput>;
}

// --- Implementation ---

export const searchSpaceHandler: SearchSpaceHandler = {
  index: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('scopes', input.scope_id),
        toStorageError,
      ),
      TE.chain((scope) =>
        TE.tryCatch(
          async () => {
            // Ensure scope exists
            if (!scope) {
              await storage.put('scopes', input.scope_id, {
                id: input.scope_id,
                scope_id: input.scope_id,
                scope_type: 'version_space',
                scope_parent: null,
              });
            }

            // Check for existing entry and update if found
            const existingEntries = await storage.find('index_entries', {
              entry_scope: input.scope_id,
              entry_provider: input.provider,
              entry_entity_id: input.entity_id,
            });

            if (existingEntries.length > 0) {
              const existing = existingEntries[0];
              await storage.put('index_entries', String(existing['id']), {
                ...existing,
                entry_operation: 'index',
                entry_data: input.data,
              });
              return indexOk(String(existing['id']));
            }

            const entryId = nextId('ssi');
            await storage.put('index_entries', entryId, {
              id: entryId,
              entry_scope: input.scope_id,
              entry_provider: input.provider,
              entry_entity_id: input.entity_id,
              entry_operation: 'index',
              entry_data: input.data,
            });

            return indexOk(entryId);
          },
          toStorageError,
        ),
      ),
    ),

  tombstone: (input, storage) =>
    pipe(
      TE.tryCatch(
        () =>
          storage.find('index_entries', {
            entry_scope: input.scope_id,
            entry_provider: input.provider,
            entry_entity_id: input.entity_id,
          }),
        toStorageError,
      ),
      TE.chain((existingEntries) => {
        if (existingEntries.length > 0) {
          const existing = existingEntries[0];
          return TE.tryCatch(
            async () => {
              await storage.put('index_entries', String(existing['id']), {
                ...existing,
                entry_operation: 'tombstone',
                entry_data: '',
              });
              return tombstoneOk(String(existing['id']));
            },
            toStorageError,
          );
        }

        const entryId = nextId('ssi');
        return TE.tryCatch(
          async () => {
            await storage.put('index_entries', entryId, {
              id: entryId,
              entry_scope: input.scope_id,
              entry_provider: input.provider,
              entry_entity_id: input.entity_id,
              entry_operation: 'tombstone',
              entry_data: '',
            });
            return tombstoneOk(entryId);
          },
          toStorageError,
        );
      }),
    ),

  query: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('scopes', input.scope_id),
        toStorageError,
      ),
      TE.chain((scope) =>
        pipe(
          O.fromNullable(scope),
          O.fold(
            () => TE.right(queryNoScope(input.scope_id)),
            (scopeRecord) =>
              TE.tryCatch(
                async () => {
                  // Get all overlay entries for this scope and provider
                  const entries = await storage.find('index_entries', {
                    entry_scope: input.scope_id,
                    entry_provider: input.provider,
                  });

                  // Collect tombstoned entity IDs
                  const tombstoned = new Set<string>();
                  for (const entry of entries) {
                    if (entry['entry_operation'] === 'tombstone') {
                      tombstoned.add(String(entry['entry_entity_id']));
                    }
                  }

                  // Collect matching results, excluding tombstoned
                  const results: string[] = [];
                  for (const entry of entries) {
                    if (
                      entry['entry_operation'] === 'index' &&
                      !tombstoned.has(String(entry['entry_entity_id']))
                    ) {
                      const data = String(entry['entry_data']);
                      if (data.toLowerCase().includes(input.query_expr.toLowerCase())) {
                        results.push(String(entry['entry_entity_id']));
                      }
                    }
                  }

                  // Walk parent scopes for nested overlay merging
                  if (scopeRecord['scope_parent']) {
                    const parentScope = String(scopeRecord['scope_parent']);
                    const parentScopeRecord = await storage.get('scopes', parentScope);
                    if (parentScopeRecord) {
                      const parentEntries = await storage.find('index_entries', {
                        entry_scope: parentScope,
                        entry_provider: input.provider,
                      });
                      for (const entry of parentEntries) {
                        const entityId = String(entry['entry_entity_id']);
                        if (
                          entry['entry_operation'] === 'index' &&
                          !tombstoned.has(entityId) &&
                          !results.includes(entityId)
                        ) {
                          const data = String(entry['entry_data']);
                          if (data.toLowerCase().includes(input.query_expr.toLowerCase())) {
                            results.push(entityId);
                          }
                        }
                      }
                    }
                  }

                  return queryOk(results);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  clear: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const entries = await storage.find('index_entries', {
            entry_scope: input.scope_id,
          });

          for (const entry of entries) {
            await storage.delete('index_entries', String(entry['id']));
          }

          // Remove scope
          await storage.delete('scopes', input.scope_id);

          return clearOk();
        },
        toStorageError,
      ),
    ),

  materialize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const entries = await storage.find('index_entries', {
            entry_scope: input.scope_id,
          });

          let count = 0;
          for (const entry of entries) {
            if (entry['entry_operation'] === 'index') {
              // In a full implementation, each entry would dispatch to its
              // provider's base-index write action. Here we count them.
              count++;
            }
          }

          // Clear after materialization
          for (const entry of entries) {
            await storage.delete('index_entries', String(entry['id']));
          }
          await storage.delete('scopes', input.scope_id);

          return materializeOk(count);
        },
        toStorageError,
      ),
    ),
};
