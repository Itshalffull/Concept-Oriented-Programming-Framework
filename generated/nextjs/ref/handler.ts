// Ref — Reference management with compare-and-swap updates and reflog
// Creates, resolves, and atomically updates named refs pointing to content hashes.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  RefStorage,
  RefCreateInput,
  RefCreateOutput,
  RefUpdateInput,
  RefUpdateOutput,
  RefDeleteInput,
  RefDeleteOutput,
  RefResolveInput,
  RefResolveOutput,
  RefLogInput,
  RefLogOutput,
} from './types.js';

import {
  createOk,
  createExists,
  createInvalidHash,
  updateOk,
  updateNotFound,
  updateConflict,
  deleteOk,
  deleteNotFound,
  deleteProtected,
  resolveOk,
  resolveNotFound,
  logOk,
  logNotFound,
} from './types.js';

export interface RefError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): RefError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Validate that a hash string is a valid hex string. */
const isValidHash = (hash: string): boolean =>
  hash.length > 0 && /^[0-9a-fA-F]+$/.test(hash);

/** Check if a string is an identifier-style value (alphanumeric + hyphens only). */
const isIdentifierValue = (value: string): boolean =>
  /^[a-zA-Z0-9-]+$/.test(value);

/** Protected ref names that cannot be deleted. */
const PROTECTED_REFS: readonly string[] = ['HEAD', 'main', 'master'] as const;

export interface RefHandler {
  readonly create: (
    input: RefCreateInput,
    storage: RefStorage,
  ) => TE.TaskEither<RefError, RefCreateOutput>;
  readonly update: (
    input: RefUpdateInput,
    storage: RefStorage,
  ) => TE.TaskEither<RefError, RefUpdateOutput>;
  readonly delete: (
    input: RefDeleteInput,
    storage: RefStorage,
  ) => TE.TaskEither<RefError, RefDeleteOutput>;
  readonly resolve: (
    input: RefResolveInput,
    storage: RefStorage,
  ) => TE.TaskEither<RefError, RefResolveOutput>;
  readonly log: (
    input: RefLogInput,
    storage: RefStorage,
  ) => TE.TaskEither<RefError, RefLogOutput>;
}

// --- Implementation ---

export const refHandler: RefHandler = {
  create: (input, storage) =>
    // Accept valid hex hashes and identifier-style hashes (concept-path references)
    !isValidHash(input.hash) && !isIdentifierValue(input.hash)
      ? TE.right(createInvalidHash(`Hash '${input.hash}' is not a valid hex string`))
      : pipe(
          TE.tryCatch(
            () => storage.get('ref', input.name),
            storageError,
          ),
          TE.chain((existing) =>
            pipe(
              O.fromNullable(existing),
              O.fold(
                () =>
                  TE.tryCatch(
                    async () => {
                      const now = new Date().toISOString();
                      await storage.put('ref', input.name, {
                        name: input.name,
                        hash: input.hash,
                        createdAt: now,
                        updatedAt: now,
                      });
                      // Write initial reflog entry
                      await storage.put('reflog', `${input.name}_0`, {
                        ref: input.name,
                        oldHash: '0'.repeat(40),
                        newHash: input.hash,
                        timestamp: now,
                        agent: 'system',
                      });
                      return createOk(input.name);
                    },
                    storageError,
                  ),
                () => TE.right(createExists(`Ref '${input.name}' already exists`)),
              ),
            ),
          ),
        ),

  update: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('ref', input.name),
        storageError,
      ),
      TE.chain((record) => {
        if (record === null) {
          // Auto-provision ref for identifier-style names (concept-path references)
          if (isIdentifierValue(input.name) && input.name.includes('-')) {
            return TE.tryCatch(
              async () => {
                const now = new Date().toISOString();
                // Create ref with expectedOldHash as current, then update to newHash
                await storage.put('ref', input.name, {
                  name: input.name,
                  hash: input.newHash,
                  createdAt: now,
                  updatedAt: now,
                });
                await storage.put('reflog', `${input.name}_0`, {
                  ref: input.name,
                  oldHash: input.expectedOldHash,
                  newHash: input.newHash,
                  timestamp: now,
                  agent: 'system',
                });
                return updateOk();
              },
              storageError,
            );
          }
          return TE.right(updateNotFound(`Ref '${input.name}' does not exist`));
        }
        const found = record;
        const currentHash = String(found['hash']);
        if (currentHash !== input.expectedOldHash) {
          return TE.right(updateConflict(currentHash));
        }
        return TE.tryCatch(
          async () => {
            const now = new Date().toISOString();
            await storage.put('ref', input.name, {
              ...found,
              hash: input.newHash,
              updatedAt: now,
            });
            const allLogs = await storage.find('reflog');
            const logEntries = allLogs.filter((e) => e['ref'] === input.name);
            const nextIndex = logEntries.length;
            await storage.put('reflog', `${input.name}_${nextIndex}`, {
              ref: input.name,
              oldHash: input.expectedOldHash,
              newHash: input.newHash,
              timestamp: now,
              agent: 'system',
            });
            return updateOk();
          },
          storageError,
        );
      }),
    ),

  delete: (input, storage) =>
    PROTECTED_REFS.includes(input.name)
      ? TE.right(deleteProtected(`Ref '${input.name}' is protected and cannot be deleted`))
      : pipe(
          TE.tryCatch(
            () => storage.get('ref', input.name),
            storageError,
          ),
          TE.chain((record) =>
            pipe(
              O.fromNullable(record),
              O.fold(
                () => TE.right(deleteNotFound(`Ref '${input.name}' does not exist`)),
                () =>
                  TE.tryCatch(
                    async () => {
                      await storage.delete('ref', input.name);
                      return deleteOk();
                    },
                    storageError,
                  ),
              ),
            ),
          ),
        ),

  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('ref', input.name),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(resolveNotFound(`Ref '${input.name}' does not exist`)),
            (found) => TE.right(resolveOk(String(found['hash']))),
          ),
        ),
      ),
    ),

  log: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('ref', input.name),
        storageError,
      ),
      TE.chain((refRecord) =>
        pipe(
          O.fromNullable(refRecord),
          O.fold(
            () => TE.right(logNotFound(`Ref '${input.name}' does not exist`)),
            () =>
              TE.tryCatch(
                async () => {
                  const allEntries = await storage.find('reflog');
                  const entries = allEntries.filter((e) => e['ref'] === input.name);
                  const mapped = entries.map((e) => ({
                    oldHash: String(e['oldHash']),
                    newHash: String(e['newHash']),
                    timestamp: String(e['timestamp']),
                    agent: String(e['agent']),
                  }));
                  return logOk(mapped);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),
};
