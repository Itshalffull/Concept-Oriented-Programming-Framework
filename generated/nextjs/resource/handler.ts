// Resource — handler.ts
// Resource management: register resources by locator, track content digests,
// detect changes via upsert, list/filter by kind, remove, and diff digests.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ResourceStorage,
  ResourceUpsertInput,
  ResourceUpsertOutput,
  ResourceGetInput,
  ResourceGetOutput,
  ResourceListInput,
  ResourceListOutput,
  ResourceRemoveInput,
  ResourceRemoveOutput,
  ResourceDiffInput,
  ResourceDiffOutput,
} from './types.js';

import {
  upsertCreated,
  upsertChanged,
  upsertUnchanged,
  getOk,
  getNotFound,
  listOk,
  removeOk,
  removeNotFound,
  diffOk,
  diffUnknown,
} from './types.js';

export interface ResourceError {
  readonly code: string;
  readonly message: string;
}

const toError = (error: unknown): ResourceError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface ResourceHandler {
  readonly upsert: (
    input: ResourceUpsertInput,
    storage: ResourceStorage,
  ) => TE.TaskEither<ResourceError, ResourceUpsertOutput>;
  readonly get: (
    input: ResourceGetInput,
    storage: ResourceStorage,
  ) => TE.TaskEither<ResourceError, ResourceGetOutput>;
  readonly list: (
    input: ResourceListInput,
    storage: ResourceStorage,
  ) => TE.TaskEither<ResourceError, ResourceListOutput>;
  readonly remove: (
    input: ResourceRemoveInput,
    storage: ResourceStorage,
  ) => TE.TaskEither<ResourceError, ResourceRemoveOutput>;
  readonly diff: (
    input: ResourceDiffInput,
    storage: ResourceStorage,
  ) => TE.TaskEither<ResourceError, ResourceDiffOutput>;
}

// --- Implementation ---

export const resourceHandler: ResourceHandler = {
  // Upsert a resource: create if new, detect changed/unchanged by comparing digests
  upsert: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('resource', input.locator),
        toError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            // Resource does not exist yet — create
            () =>
              TE.tryCatch(
                async () => {
                  const lm = typeof input.lastModified === 'object' && input.lastModified !== null && '_tag' in (input.lastModified as any)
                    ? pipe(input.lastModified, O.getOrElse(() => new Date()))
                    : (input.lastModified instanceof Date ? input.lastModified : new Date());
                  const sz = typeof input.size === 'object' && input.size !== null && '_tag' in (input.size as any)
                    ? pipe(input.size, O.getOrElse(() => 0))
                    : (typeof input.size === 'number' ? input.size : 0);
                  await storage.put('resource', input.locator, {
                    locator: input.locator,
                    kind: input.kind,
                    digest: input.digest,
                    lastModified: (lm instanceof Date ? lm : new Date()).toISOString(),
                    size: sz,
                    createdAt: new Date().toISOString(),
                  });
                  return upsertCreated(input.locator);
                },
                toError,
              ),
            // Resource exists — compare digests
            (found) => {
              const previousDigest = (found.digest as string) ?? '';
              if (previousDigest === input.digest) {
                return TE.right(upsertUnchanged(input.locator));
              }
              return TE.tryCatch(
                async () => {
                  const lm2 = typeof input.lastModified === 'object' && input.lastModified !== null && '_tag' in (input.lastModified as any)
                    ? pipe(input.lastModified, O.getOrElse(() => new Date()))
                    : (input.lastModified instanceof Date ? input.lastModified : new Date());
                  const sz2 = typeof input.size === 'object' && input.size !== null && '_tag' in (input.size as any)
                    ? pipe(input.size, O.getOrElse(() => (found.size as number) ?? 0))
                    : (typeof input.size === 'number' ? input.size : (found.size as number) ?? 0);
                  await storage.put('resource', input.locator, {
                    ...found,
                    digest: input.digest,
                    kind: input.kind,
                    lastModified: (lm2 instanceof Date ? lm2 : new Date()).toISOString(),
                    size: sz2,
                    updatedAt: new Date().toISOString(),
                  });
                  return upsertChanged(input.locator, previousDigest);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  // Get a resource by locator
  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('resource', input.locator),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotFound(input.locator)),
            (found) =>
              TE.right(
                getOk(
                  input.locator,
                  (found.kind as string) ?? '',
                  (found.digest as string) ?? '',
                ),
              ),
          ),
        ),
      ),
    ),

  // List all resources, optionally filtered by kind
  list: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const all = await storage.find('resource');
          const kindVal = (input as any).kind;
          const filtered = (typeof kindVal === 'string')
            ? all.filter((r) => r.kind === kindVal)
            : (typeof kindVal === 'object' && kindVal !== null && '_tag' in kindVal)
              ? pipe(kindVal, O.fold(() => all, (kf: string) => all.filter((r) => r.kind === kf)))
              : all;
          const resources = filtered.map((r) => ({
            locator: (r.locator as string) ?? '',
            kind: (r.kind as string) ?? '',
            digest: (r.digest as string) ?? '',
          }));
          return listOk(resources);
        },
        toError,
      ),
    ),

  // Remove a resource by locator
  remove: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('resource', input.locator),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(removeNotFound(input.locator)),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('resource', input.locator);
                  return removeOk(input.locator);
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  // Diff two digests for a resource to determine the change type
  diff: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('resource', input.locator),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(diffUnknown(`Resource '${input.locator}' not found`)),
            () => {
              if (input.oldDigest === input.newDigest) {
                return TE.right(diffOk('unchanged'));
              }
              if (input.oldDigest === '') {
                return TE.right(diffOk('added'));
              }
              if (input.newDigest === '') {
                return TE.right(diffOk('removed'));
              }
              return TE.right(diffOk('modified'));
            },
          ),
        ),
      ),
    ),
};
