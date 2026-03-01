// Checkpoint — handler.ts
// Real fp-ts domain logic for process state snapshots with capture, restore, find, and prune.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  CheckpointStorage,
  CheckpointCaptureInput,
  CheckpointCaptureOutput,
  CheckpointRestoreInput,
  CheckpointRestoreOutput,
  CheckpointFindLatestInput,
  CheckpointFindLatestOutput,
  CheckpointPruneInput,
  CheckpointPruneOutput,
} from './types.js';

import {
  captureOk,
  restoreOk,
  restoreNotFound,
  findLatestOk,
  findLatestNotFound,
  pruneOk,
} from './types.js';

export interface CheckpointError {
  readonly code: string;
  readonly message: string;
}

export interface CheckpointHandler {
  readonly capture: (
    input: CheckpointCaptureInput,
    storage: CheckpointStorage,
  ) => TE.TaskEither<CheckpointError, CheckpointCaptureOutput>;
  readonly restore: (
    input: CheckpointRestoreInput,
    storage: CheckpointStorage,
  ) => TE.TaskEither<CheckpointError, CheckpointRestoreOutput>;
  readonly find_latest: (
    input: CheckpointFindLatestInput,
    storage: CheckpointStorage,
  ) => TE.TaskEither<CheckpointError, CheckpointFindLatestOutput>;
  readonly prune: (
    input: CheckpointPruneInput,
    storage: CheckpointStorage,
  ) => TE.TaskEither<CheckpointError, CheckpointPruneOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): CheckpointError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

let checkpointCounter = 0;
const generateCheckpointId = (run_ref: string, step_ref: string): string =>
  `${run_ref}::${step_ref}::${Date.now()}-${++checkpointCounter}`;

// --- Implementation ---

export const checkpointHandler: CheckpointHandler = {
  /**
   * Capture a snapshot of the current process state at a given step.
   * Each checkpoint is uniquely identified and includes a timestamp.
   * Multiple checkpoints can exist for the same run_ref.
   */
  capture: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const now = new Date().toISOString();
          const checkpointId = generateCheckpointId(input.run_ref, input.step_ref);

          await storage.put('checkpoints', checkpointId, {
            checkpoint_id: checkpointId,
            run_ref: input.run_ref,
            step_ref: input.step_ref,
            state: input.state,
            label: input.label ?? '',
            captured_at: now,
            created_at: now,
          });

          // Also maintain an index of checkpoints by run_ref for fast lookup
          const indexKey = `index::${input.run_ref}`;
          const existingIndex = await storage.get('checkpoint_index', indexKey);
          const entries = existingIndex
            ? (existingIndex.entries as string[]) ?? []
            : [];

          await storage.put('checkpoint_index', indexKey, {
            run_ref: input.run_ref,
            entries: [...entries, checkpointId],
            updated_at: now,
          });

          return captureOk(checkpointId, input.run_ref, input.step_ref, now);
        },
        storageError,
      ),
    ),

  /**
   * Restore a specific checkpoint by ID. Returns the full state snapshot
   * that was captured, allowing the process to resume from that point.
   */
  restore: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('checkpoints', input.checkpoint_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<CheckpointError, CheckpointRestoreOutput>(
              restoreNotFound(`Checkpoint '${input.checkpoint_id}' not found`),
            ),
            (cp) =>
              TE.right<CheckpointError, CheckpointRestoreOutput>(
                restoreOk(
                  cp.checkpoint_id as string,
                  cp.run_ref as string,
                  cp.step_ref as string,
                  (cp.state as Record<string, unknown>) ?? {},
                ),
              ),
          ),
        ),
      ),
    ),

  /**
   * Find the most recently captured checkpoint for a given run.
   * Uses the checkpoint index to efficiently locate the latest entry.
   */
  find_latest: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('checkpoint_index', `index::${input.run_ref}`),
        storageError,
      ),
      TE.chain((indexRecord) =>
        pipe(
          O.fromNullable(indexRecord),
          O.fold(
            () => TE.right<CheckpointError, CheckpointFindLatestOutput>(
              findLatestNotFound(`No checkpoints found for run '${input.run_ref}'`),
            ),
            (idx) => {
              const entries = (idx.entries as string[]) ?? [];
              if (entries.length === 0) {
                return TE.right<CheckpointError, CheckpointFindLatestOutput>(
                  findLatestNotFound(`No checkpoints found for run '${input.run_ref}'`),
                );
              }
              // Latest checkpoint is the last entry in the index
              const latestId = entries[entries.length - 1];
              return pipe(
                TE.tryCatch(
                  () => storage.get('checkpoints', latestId),
                  storageError,
                ),
                TE.chain((cpRecord) =>
                  pipe(
                    O.fromNullable(cpRecord),
                    O.fold(
                      () => TE.right<CheckpointError, CheckpointFindLatestOutput>(
                        findLatestNotFound(`Checkpoint '${latestId}' data not found`),
                      ),
                      (cp) =>
                        TE.right<CheckpointError, CheckpointFindLatestOutput>(
                          findLatestOk(
                            cp.checkpoint_id as string,
                            cp.run_ref as string,
                            cp.step_ref as string,
                            cp.captured_at as string,
                          ),
                        ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Prune old checkpoints for a run, keeping only the most recent keep_count.
   * Deletes the oldest checkpoints first, maintaining the LIFO order for restore.
   */
  prune: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('checkpoint_index', `index::${input.run_ref}`),
        storageError,
      ),
      TE.chain((indexRecord) => {
        const entries = indexRecord
          ? ((indexRecord.entries as string[]) ?? [])
          : [];

        if (entries.length <= input.keep_count) {
          // Nothing to prune
          return TE.right<CheckpointError, CheckpointPruneOutput>(
            pruneOk(input.run_ref, 0, entries.length),
          );
        }

        const toDelete = entries.slice(0, entries.length - input.keep_count);
        const toKeep = entries.slice(entries.length - input.keep_count);

        return TE.tryCatch(
          async () => {
            // Delete old checkpoint records
            for (const cpId of toDelete) {
              await storage.delete('checkpoints', cpId);
            }

            // Update the index to only contain kept entries
            const indexKey = `index::${input.run_ref}`;
            await storage.put('checkpoint_index', indexKey, {
              run_ref: input.run_ref,
              entries: toKeep,
              updated_at: new Date().toISOString(),
            });

            return pruneOk(input.run_ref, toDelete.length, toKeep.length);
          },
          storageError,
        );
      }),
    ),
};
