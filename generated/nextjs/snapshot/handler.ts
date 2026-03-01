// Snapshot — Point-in-time snapshot management: compare current content against
// baselines, approve/reject changes, view status across paths, compute diffs,
// and clean orphaned snapshots.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SnapshotStorage,
  SnapshotCompareInput,
  SnapshotCompareOutput,
  SnapshotApproveInput,
  SnapshotApproveOutput,
  SnapshotApproveAllInput,
  SnapshotApproveAllOutput,
  SnapshotRejectInput,
  SnapshotRejectOutput,
  SnapshotStatusInput,
  SnapshotStatusOutput,
  SnapshotDiffInput,
  SnapshotDiffOutput,
  SnapshotCleanInput,
  SnapshotCleanOutput,
} from './types.js';

import {
  compareUnchanged,
  compareChanged,
  compareNew,
  approveOk,
  approveNoChange,
  approveAllOk,
  rejectOk,
  rejectNoChange,
  statusOk,
  diffOk,
  diffNoBaseline,
  diffUnchanged,
  cleanOk,
} from './types.js';

export interface SnapshotError {
  readonly code: string;
  readonly message: string;
}

const toSnapshotError = (error: unknown): SnapshotError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Simple content hash for comparison
const hashContent = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
};

export interface SnapshotHandler {
  readonly compare: (
    input: SnapshotCompareInput,
    storage: SnapshotStorage,
  ) => TE.TaskEither<SnapshotError, SnapshotCompareOutput>;
  readonly approve: (
    input: SnapshotApproveInput,
    storage: SnapshotStorage,
  ) => TE.TaskEither<SnapshotError, SnapshotApproveOutput>;
  readonly approveAll: (
    input: SnapshotApproveAllInput,
    storage: SnapshotStorage,
  ) => TE.TaskEither<SnapshotError, SnapshotApproveAllOutput>;
  readonly reject: (
    input: SnapshotRejectInput,
    storage: SnapshotStorage,
  ) => TE.TaskEither<SnapshotError, SnapshotRejectOutput>;
  readonly status: (
    input: SnapshotStatusInput,
    storage: SnapshotStorage,
  ) => TE.TaskEither<SnapshotError, SnapshotStatusOutput>;
  readonly diff: (
    input: SnapshotDiffInput,
    storage: SnapshotStorage,
  ) => TE.TaskEither<SnapshotError, SnapshotDiffOutput>;
  readonly clean: (
    input: SnapshotCleanInput,
    storage: SnapshotStorage,
  ) => TE.TaskEither<SnapshotError, SnapshotCleanOutput>;
}

// --- Implementation ---

export const snapshotHandler: SnapshotHandler = {
  // Compare current content against the stored baseline for a path.
  compare: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('snapshot', input.outputPath),
        toSnapshotError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            // No existing baseline -- this is a new snapshot
            () => {
              const contentHash = hashContent(input.currentContent);
              return TE.tryCatch(
                async () => {
                  await storage.put('snapshot', input.outputPath, {
                    path: input.outputPath,
                    contentHash,
                    content: input.currentContent,
                    status: 'new',
                    createdAt: new Date().toISOString(),
                  });
                  return compareNew(input.outputPath, contentHash);
                },
                toSnapshotError,
              );
            },
            (existing) => {
              const r = existing as Record<string, unknown>;
              const baselineHash = String(r.contentHash ?? '');
              const currentHash = hashContent(input.currentContent);
              if (baselineHash === currentHash) {
                return TE.right<SnapshotError, SnapshotCompareOutput>(
                  compareUnchanged(input.outputPath),
                );
              }
              // Content changed: compute line-level diff metrics
              const baselineContent = String(r.content ?? '');
              const baselineLines = baselineContent.split('\n');
              const currentLines = input.currentContent.split('\n');
              const linesAdded = Math.max(0, currentLines.length - baselineLines.length);
              const linesRemoved = Math.max(0, baselineLines.length - currentLines.length);
              const diff = `- ${baselineHash}\n+ ${currentHash}`;
              return TE.tryCatch(
                async () => {
                  await storage.put('snapshot', input.outputPath, {
                    ...existing,
                    pendingContent: input.currentContent,
                    pendingHash: currentHash,
                    status: 'changed',
                  });
                  return compareChanged(input.outputPath, diff, linesAdded, linesRemoved);
                },
                toSnapshotError,
              );
            },
          ),
        ),
      ),
    ),

  // Approve the current snapshot, promoting pending content to the baseline.
  approve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('snapshot', input.path),
        toSnapshotError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<SnapshotError, SnapshotApproveOutput>(approveNoChange(input.path)),
            (existing) => {
              const r = existing as Record<string, unknown>;
              if (r.status === 'approved' || (!r.pendingContent && r.status !== 'new')) {
                return TE.right<SnapshotError, SnapshotApproveOutput>(approveNoChange(input.path));
              }
              return TE.tryCatch(
                async () => {
                  const approver = pipe(input.approver, O.fold(() => 'system', (a) => a));
                  const content = r.pendingContent ?? r.content;
                  const hash = r.pendingHash ?? r.contentHash;
                  await storage.put('snapshot', input.path, {
                    ...existing,
                    content,
                    contentHash: hash,
                    pendingContent: null,
                    pendingHash: null,
                    status: 'approved',
                    approvedAt: new Date().toISOString(),
                    approvedBy: approver,
                  });
                  return approveOk(input.path);
                },
                toSnapshotError,
              );
            },
          ),
        ),
      ),
    ),

  // Approve all pending snapshots, optionally filtered by paths.
  approveAll: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allSnapshots = await storage.find('snapshot');
          const pathFilter = pipe(
            input.paths,
            O.fold(() => null as readonly string[] | null, (p) => p),
          );
          let approved = 0;
          for (const snap of allSnapshots) {
            const r = snap as Record<string, unknown>;
            const path = String(r.path ?? '');
            const status = String(r.status ?? '');
            if (status !== 'approved' && (pathFilter === null || pathFilter.includes(path))) {
              const content = r.pendingContent ?? r.content;
              const hash = r.pendingHash ?? r.contentHash;
              await storage.put('snapshot', path, {
                ...snap,
                content,
                contentHash: hash,
                pendingContent: null,
                pendingHash: null,
                status: 'approved',
                approvedAt: new Date().toISOString(),
              });
              approved += 1;
            }
          }
          return approveAllOk(approved);
        },
        toSnapshotError,
      ),
    ),

  // Reject a pending snapshot change, discarding the pending content.
  reject: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('snapshot', input.path),
        toSnapshotError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<SnapshotError, SnapshotRejectOutput>(rejectNoChange(input.path)),
            (existing) => {
              const r = existing as Record<string, unknown>;
              if (!r.pendingContent) {
                return TE.right<SnapshotError, SnapshotRejectOutput>(rejectNoChange(input.path));
              }
              return TE.tryCatch(
                async () => {
                  await storage.put('snapshot', input.path, {
                    ...existing,
                    pendingContent: null,
                    pendingHash: null,
                    status: 'rejected',
                  });
                  return rejectOk(input.path);
                },
                toSnapshotError,
              );
            },
          ),
        ),
      ),
    ),

  // Show the status of all snapshots, optionally filtered by paths.
  status: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allSnapshots = await storage.find('snapshot');
          const pathFilter = pipe(
            input.paths,
            O.fold(() => null as readonly string[] | null, (p) => p),
          );
          const results = allSnapshots
            .filter((snap) => {
              if (pathFilter === null) return true;
              return pathFilter.includes(String((snap as Record<string, unknown>).path ?? ''));
            })
            .map((snap) => {
              const r = snap as Record<string, unknown>;
              return {
                path: String(r.path ?? ''),
                status: String(r.status ?? 'unknown'),
                linesChanged: O.none as O.Option<number>,
                approvedAt: r.approvedAt
                  ? O.some(new Date(String(r.approvedAt)))
                  : O.none as O.Option<Date>,
              } as const;
            });
          return statusOk(results);
        },
        toSnapshotError,
      ),
    ),

  // Compute the diff between the baseline and pending content for a path.
  diff: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('snapshot', input.path),
        toSnapshotError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<SnapshotError, SnapshotDiffOutput>(diffNoBaseline(input.path)),
            (found) => {
              const r = found as Record<string, unknown>;
              if (!r.pendingContent) {
                return TE.right<SnapshotError, SnapshotDiffOutput>(diffUnchanged(input.path));
              }
              const baselineContent = String(r.content ?? '');
              const pendingContent = String(r.pendingContent ?? '');
              const baselineLines = baselineContent.split('\n');
              const pendingLines = pendingContent.split('\n');
              const linesAdded = Math.max(0, pendingLines.length - baselineLines.length);
              const linesRemoved = Math.max(0, baselineLines.length - pendingLines.length);
              const diffText = `- ${String(r.contentHash ?? '')}\n+ ${String(r.pendingHash ?? '')}`;
              return TE.right<SnapshotError, SnapshotDiffOutput>(
                diffOk(diffText, linesAdded, linesRemoved),
              );
            },
          ),
        ),
      ),
    ),

  // Clean orphaned snapshots from a given output directory.
  clean: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allSnapshots = await storage.find('snapshot');
          const removed: string[] = [];
          for (const snap of allSnapshots) {
            const path = String((snap as Record<string, unknown>).path ?? '');
            if (path.startsWith(input.outputDir)) {
              await storage.delete('snapshot', path);
              removed.push(path);
            }
          }
          return cleanOk(removed);
        },
        toSnapshotError,
      ),
    ),
};
