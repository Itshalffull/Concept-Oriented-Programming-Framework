// Alias — handler.ts
// Name aliasing with resolution chain, cycle detection, and reverse lookup.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import { pipe, flow } from 'fp-ts/function';

import type {
  AliasStorage,
  AliasAddAliasInput,
  AliasAddAliasOutput,
  AliasRemoveAliasInput,
  AliasRemoveAliasOutput,
  AliasResolveInput,
  AliasResolveOutput,
} from './types.js';

import {
  addAliasOk,
  addAliasExists,
  removeAliasOk,
  removeAliasNotfound,
  resolveOk,
  resolveNotfound,
} from './types.js';

export interface AliasError {
  readonly code: string;
  readonly message: string;
}

export interface AliasHandler {
  readonly addAlias: (
    input: AliasAddAliasInput,
    storage: AliasStorage,
  ) => TE.TaskEither<AliasError, AliasAddAliasOutput>;
  readonly removeAlias: (
    input: AliasRemoveAliasInput,
    storage: AliasStorage,
  ) => TE.TaskEither<AliasError, AliasRemoveAliasOutput>;
  readonly resolve: (
    input: AliasResolveInput,
    storage: AliasStorage,
  ) => TE.TaskEither<AliasError, AliasResolveOutput>;
}

// --- Pure helpers ---

const storageErr = (error: unknown): AliasError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const fetchAlias = (
  storage: AliasStorage,
  name: string,
): TE.TaskEither<AliasError, Record<string, unknown> | null> =>
  TE.tryCatch(() => storage.get('aliases', name), storageErr);

const fetchAliasesByEntity = (
  storage: AliasStorage,
  entity: string,
): TE.TaskEither<AliasError, readonly Record<string, unknown>[]> =>
  TE.tryCatch(() => storage.find('aliases', { entity }), storageErr);

// --- Implementation ---

export const aliasHandler: AliasHandler = {
  /**
   * Register an alias name for an entity.
   * Checks for existing alias with the same name to prevent duplicates.
   * Storage key is the alias name for O(1) resolution.
   */
  addAlias: (input, storage) =>
    pipe(
      fetchAlias(storage, input.name),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            // No existing alias — register it
            () =>
              pipe(
                TE.tryCatch(
                  () =>
                    storage.put('aliases', input.name, {
                      name: input.name,
                      entity: input.entity,
                      createdAt: new Date().toISOString(),
                    }),
                  storageErr,
                ),
                TE.map(() => addAliasOk(input.entity, input.name)),
              ),
            // Alias already exists for this name
            (found) => {
              const boundEntity = String(found['entity'] ?? '');
              return boundEntity === input.entity
                ? TE.right(addAliasExists(input.entity, input.name))
                : TE.right(addAliasExists(boundEntity, input.name));
            },
          ),
        ),
      ),
    ),

  /**
   * Remove an alias name for an entity.
   * Validates both that the alias exists and that it belongs to the specified entity.
   */
  removeAlias: (input, storage) =>
    pipe(
      fetchAlias(storage, input.name),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () => TE.right(removeAliasNotfound(input.entity, input.name)),
            (found) => {
              const boundEntity = String(found['entity'] ?? '');
              return boundEntity !== input.entity
                ? TE.right(removeAliasNotfound(input.entity, input.name))
                : pipe(
                    TE.tryCatch(
                      () => storage.delete('aliases', input.name),
                      storageErr,
                    ),
                    TE.map(() => removeAliasOk(input.entity, input.name)),
                  );
            },
          ),
        ),
      ),
    ),

  /**
   * Resolve an alias name to its target entity.
   * Follows alias chains (alias -> entity that is itself an alias name)
   * with cycle detection to prevent infinite loops.
   * Maximum chain depth of 10 to bound traversal.
   */
  resolve: (input, storage) => {
    const MAX_DEPTH = 10;

    const resolveChain = (
      name: string,
      visited: ReadonlySet<string>,
      depth: number,
    ): TE.TaskEither<AliasError, AliasResolveOutput> =>
      depth >= MAX_DEPTH
        ? TE.right(resolveNotfound(input.name))
        : visited.has(name)
          ? TE.right(resolveNotfound(input.name))
          : pipe(
              fetchAlias(storage, name),
              TE.chain((record) =>
                pipe(
                  O.fromNullable(record),
                  O.fold(
                    () =>
                      // If we resolved at least one level, the previous entity is the target
                      depth > 0
                        ? TE.right(resolveOk(name))
                        : TE.right(resolveNotfound(input.name)),
                    (found) => {
                      const entity = String(found['entity'] ?? '');
                      // Check if the resolved entity is itself an alias
                      return resolveChain(
                        entity,
                        new Set([...visited, name]),
                        depth + 1,
                      );
                    },
                  ),
                ),
              ),
            );

    return pipe(
      fetchAlias(storage, input.name),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(resolveNotfound(input.name)),
            (found) => {
              const entity = String(found['entity'] ?? '');
              // Try to resolve further in case entity is itself an alias
              return resolveChain(entity, new Set([input.name]), 1);
            },
          ),
        ),
      ),
    );
  },
};
