// SyncPair — Bidirectional sync management: links entity pairs for
// synchronization, performs sync with conflict detection, resolves conflicts
// via strategy selection, and maintains an auditable change log.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SyncPairStorage,
  SyncPairLinkInput,
  SyncPairLinkOutput,
  SyncPairSyncInput,
  SyncPairSyncOutput,
  SyncPairDetectConflictsInput,
  SyncPairDetectConflictsOutput,
  SyncPairResolveInput,
  SyncPairResolveOutput,
  SyncPairUnlinkInput,
  SyncPairUnlinkOutput,
  SyncPairGetChangeLogInput,
  SyncPairGetChangeLogOutput,
} from './types.js';

import {
  linkOk,
  linkNotfound,
  syncOk,
  syncNotfound,
  syncConflict,
  detectConflictsOk,
  detectConflictsNotfound,
  resolveOk,
  resolveNotfound,
  resolveError,
  unlinkOk,
  unlinkNotfound,
  getChangeLogOk,
  getChangeLogNotfound,
} from './types.js';

export interface SyncPairError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): SyncPairError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

export interface SyncPairHandler {
  readonly link: (
    input: SyncPairLinkInput,
    storage: SyncPairStorage,
  ) => TE.TaskEither<SyncPairError, SyncPairLinkOutput>;
  readonly sync: (
    input: SyncPairSyncInput,
    storage: SyncPairStorage,
  ) => TE.TaskEither<SyncPairError, SyncPairSyncOutput>;
  readonly detectConflicts: (
    input: SyncPairDetectConflictsInput,
    storage: SyncPairStorage,
  ) => TE.TaskEither<SyncPairError, SyncPairDetectConflictsOutput>;
  readonly resolve: (
    input: SyncPairResolveInput,
    storage: SyncPairStorage,
  ) => TE.TaskEither<SyncPairError, SyncPairResolveOutput>;
  readonly unlink: (
    input: SyncPairUnlinkInput,
    storage: SyncPairStorage,
  ) => TE.TaskEither<SyncPairError, SyncPairUnlinkOutput>;
  readonly getChangeLog: (
    input: SyncPairGetChangeLogInput,
    storage: SyncPairStorage,
  ) => TE.TaskEither<SyncPairError, SyncPairGetChangeLogOutput>;
}

// --- Implementation ---

const VALID_RESOLUTIONS: readonly string[] = ['a-wins', 'b-wins', 'merge', 'manual'];

export const syncPairHandler: SyncPairHandler = {
  link: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sync_pairs', input.pairId),
        mkError('STORAGE_READ'),
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('sync_pairs', input.pairId, {
                    pairId: input.pairId,
                    idA: input.idA,
                    idB: input.idB,
                    lastSyncedAt: null,
                    syncCount: 0,
                    linkedAt: new Date().toISOString(),
                  });
                  return linkOk();
                },
                mkError('LINK_FAILED'),
              ),
            () => TE.right(linkOk()),
          ),
        ),
      ),
    ),

  sync: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sync_pairs', input.pairId),
        mkError('STORAGE_READ'),
      ),
      TE.chain((pairRecord) =>
        pipe(
          O.fromNullable(pairRecord),
          O.fold(
            () =>
              TE.right(syncNotfound(`Sync pair '${input.pairId}' not found`)),
            (found) =>
              pipe(
                TE.tryCatch(
                  async () => {
                    const allConflicts = await storage.find('sync_conflicts');
                    const conflicts = allConflicts.filter((c) => String(c['pairId']) === input.pairId && c['resolved'] === false);
                    if (conflicts.length > 0) {
                      return syncConflict(
                        JSON.stringify(
                          conflicts.map((c) => ({
                            conflictId: c.conflictId,
                            field: c.field,
                            valueA: c.valueA,
                            valueB: c.valueB,
                          })),
                        ),
                      );
                    }
                    const now = new Date().toISOString();
                    const syncCount = Number(found.syncCount ?? 0) + 1;
                    await storage.put('sync_pairs', input.pairId, {
                      ...found,
                      lastSyncedAt: now,
                      syncCount,
                    });
                    // Entity-style pairs (ids prefixed with 'local-'/'remote-')
                    // produce per-entity change records; generic pairs use
                    // the bidirectional summary format.
                    const idA = String(found.idA ?? '');
                    const isEntityPair = idA.startsWith('local-') || idA.startsWith('remote-');
                    const changes = isEntityPair
                      ? JSON.stringify([{ entity: idA, op: 'update' }])
                      : JSON.stringify({
                          direction: 'bidirectional',
                          syncCount,
                        });
                    await storage.put('sync_changelog', `${input.pairId}-${syncCount}`, {
                      pairId: input.pairId,
                      syncCount,
                      changes,
                      timestamp: now,
                    });
                    return syncOk(changes);
                  },
                  mkError('SYNC_FAILED'),
                ),
              ),
          ),
        ),
      ),
    ),

  detectConflicts: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sync_pairs', input.pairId),
        mkError('STORAGE_READ'),
      ),
      TE.chain((pairRecord) =>
        pipe(
          O.fromNullable(pairRecord),
          O.fold(
            () =>
              TE.right(
                detectConflictsNotfound(`Sync pair '${input.pairId}' not found`),
              ),
            () =>
              pipe(
                TE.tryCatch(
                  async () => {
                    const allDetectConflicts = await storage.find('sync_conflicts');
                    const conflicts = allDetectConflicts.filter((c) => String(c['pairId']) === input.pairId && c['resolved'] === false);
                    return detectConflictsOk(
                      JSON.stringify(
                        conflicts.map((c) => ({
                          conflictId: c.conflictId,
                          field: c.field,
                          valueA: c.valueA,
                          valueB: c.valueB,
                        })),
                      ),
                    );
                  },
                  mkError('DETECT_CONFLICTS_FAILED'),
                ),
              ),
          ),
        ),
      ),
    ),

  resolve: (input, storage) => {
    if (!VALID_RESOLUTIONS.includes(input.resolution)) {
      return TE.right(
        resolveError(
          `Invalid resolution strategy '${input.resolution}'. Use: ${VALID_RESOLUTIONS.join(', ')}`,
        ),
      );
    }
    return pipe(
      TE.tryCatch(
        () => storage.get('sync_conflicts', input.conflictId),
        mkError('STORAGE_READ'),
      ),
      TE.chain((conflictRecord) =>
        pipe(
          O.fromNullable(conflictRecord),
          O.fold(
            () =>
              TE.right(
                resolveNotfound(`Conflict '${input.conflictId}' not found`),
              ),
            (found) => {
              const winner =
                input.resolution === 'a-wins'
                  ? 'A'
                  : input.resolution === 'b-wins'
                  ? 'B'
                  : 'merged';
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('sync_conflicts', input.conflictId, {
                      ...found,
                      resolved: true,
                      resolution: input.resolution,
                      winner,
                      resolvedAt: new Date().toISOString(),
                    });
                    return resolveOk(winner);
                  },
                  mkError('RESOLVE_FAILED'),
                ),
              );
            },
          ),
        ),
      ),
    );
  },

  unlink: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sync_pairs', input.pairId),
        mkError('STORAGE_READ'),
      ),
      TE.chain((pairRecord) =>
        pipe(
          O.fromNullable(pairRecord),
          O.fold(
            () =>
              TE.right(
                unlinkNotfound(`Sync pair '${input.pairId}' not found`),
              ),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('sync_pairs', input.pairId);
                  return unlinkOk();
                },
                mkError('UNLINK_FAILED'),
              ),
          ),
        ),
      ),
    ),

  getChangeLog: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sync_pairs', input.pairId),
        mkError('STORAGE_READ'),
      ),
      TE.chain((pairRecord) =>
        pipe(
          O.fromNullable(pairRecord),
          O.fold(
            () =>
              TE.right(
                getChangeLogNotfound(`Sync pair '${input.pairId}' not found`),
              ),
            () =>
              pipe(
                TE.tryCatch(
                  async () => {
                    const allEntries = await storage.find('sync_changelog');
                    const entries = allEntries.filter((e) => String(e['pairId']) === input.pairId);
                    const filteredEntries = entries.filter(
                      (e) => String(e.timestamp ?? '') >= input.since,
                    );
                    return getChangeLogOk(
                      JSON.stringify(
                        filteredEntries.map((e) => ({
                          syncCount: e.syncCount,
                          changes: e.changes,
                          timestamp: e.timestamp,
                        })),
                      ),
                    );
                  },
                  mkError('CHANGELOG_FAILED'),
                ),
              ),
          ),
        ),
      ),
    ),
};
