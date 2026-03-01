// Version — handler.ts
// Track content change history with snapshots enabling rollback,
// diff comparison, and audit trails.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  VersionStorage,
  VersionSnapshotInput,
  VersionSnapshotOutput,
  VersionListVersionsInput,
  VersionListVersionsOutput,
  VersionRollbackInput,
  VersionRollbackOutput,
  VersionDiffInput,
  VersionDiffOutput,
} from './types.js';

import {
  snapshotOk,
  listVersionsOk,
  rollbackOk,
  rollbackNotfound,
  diffOk,
  diffNotfound,
} from './types.js';

export interface VersionError {
  readonly code: string;
  readonly message: string;
}

export interface VersionHandler {
  readonly snapshot: (
    input: VersionSnapshotInput,
    storage: VersionStorage,
  ) => TE.TaskEither<VersionError, VersionSnapshotOutput>;
  readonly listVersions: (
    input: VersionListVersionsInput,
    storage: VersionStorage,
  ) => TE.TaskEither<VersionError, VersionListVersionsOutput>;
  readonly rollback: (
    input: VersionRollbackInput,
    storage: VersionStorage,
  ) => TE.TaskEither<VersionError, VersionRollbackOutput>;
  readonly diff: (
    input: VersionDiffInput,
    storage: VersionStorage,
  ) => TE.TaskEither<VersionError, VersionDiffOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): VersionError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const nowISO = (): string => new Date().toISOString();

// Compute a simple line-level diff between two text snapshots.
// Returns a human-readable unified-style diff string.
const computeLineDiff = (textA: string, textB: string): string => {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  const changes: string[] = [];

  const maxLen = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < maxLen; i++) {
    const lineA = i < linesA.length ? linesA[i] : undefined;
    const lineB = i < linesB.length ? linesB[i] : undefined;

    if (lineA === lineB) {
      changes.push(` ${lineA ?? ''}`);
    } else {
      if (lineA !== undefined) {
        changes.push(`-${lineA}`);
      }
      if (lineB !== undefined) {
        changes.push(`+${lineB}`);
      }
    }
  }

  return changes.join('\n');
};

// --- Implementation ---

export const versionHandler: VersionHandler = {
  // Captures a point-in-time snapshot of the entity's content with
  // timestamp and author metadata for audit trail.
  snapshot: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const timestamp = nowISO();
          const record: Record<string, unknown> = {
            id: input.version,
            entity: input.entity,
            data: input.data,
            author: input.author,
            timestamp,
            createdAt: timestamp,
          };
          await storage.put('version', input.version, record);

          // Maintain entity-to-versions index for efficient listing
          const indexRecord = await storage.get('version_index', input.entity);
          const existingVersions: readonly string[] = indexRecord !== null
            ? (Array.isArray(indexRecord.versions)
              ? indexRecord.versions as string[]
              : [])
            : [];
          const updatedVersions = [...existingVersions, input.version];
          await storage.put('version_index', input.entity, {
            entity: input.entity,
            versions: updatedVersions,
          });

          return snapshotOk(input.version);
        },
        storageError,
      ),
    ),

  // Returns all recorded snapshots for the given entity in chronological order.
  // Returns version IDs as a comma-separated string.
  listVersions: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const indexRecord = await storage.get('version_index', input.entity);
          if (indexRecord === null) {
            return listVersionsOk('');
          }

          const versions: readonly string[] = Array.isArray(indexRecord.versions)
            ? indexRecord.versions as string[]
            : [];

          return listVersionsOk(versions.join(','));
        },
        storageError,
      ),
    ),

  // Restores the entity to the state captured in the specified snapshot.
  // Returns the snapshot data for the caller to apply.
  rollback: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('version', input.version),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<VersionError, VersionRollbackOutput>(
              rollbackNotfound(`Version ${input.version} does not exist`),
            ),
            (snapshot) => {
              const data = typeof snapshot.data === 'string'
                ? snapshot.data
                : JSON.stringify(snapshot.data ?? '');
              return TE.right<VersionError, VersionRollbackOutput>(
                rollbackOk(data),
              );
            },
          ),
        ),
      ),
    ),

  // Computes the differences between two snapshots using line-level diff.
  // Returns notfound if either version does not exist.
  diff: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => Promise.all([
          storage.get('version', input.versionA),
          storage.get('version', input.versionB),
        ]),
        storageError,
      ),
      TE.chain(([recordA, recordB]) => {
        if (recordA === null) {
          return TE.right<VersionError, VersionDiffOutput>(
            diffNotfound(`Version ${input.versionA} does not exist`),
          );
        }
        if (recordB === null) {
          return TE.right<VersionError, VersionDiffOutput>(
            diffNotfound(`Version ${input.versionB} does not exist`),
          );
        }

        const dataA = typeof recordA.data === 'string' ? recordA.data : '';
        const dataB = typeof recordB.data === 'string' ? recordB.data : '';

        const changes = computeLineDiff(dataA, dataB);
        return TE.right<VersionError, VersionDiffOutput>(diffOk(changes));
      }),
    ),
};
