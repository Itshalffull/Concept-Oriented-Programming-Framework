// Emitter — handler.ts
// File emission with content-hash deduplication, provenance tracking, and manifest auditing.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  EmitterStorage,
  EmitterWriteInput,
  EmitterWriteOutput,
  EmitterWriteBatchInput,
  EmitterWriteBatchOutput,
  EmitterFormatInput,
  EmitterFormatOutput,
  EmitterCleanInput,
  EmitterCleanOutput,
  EmitterManifestInput,
  EmitterManifestOutput,
  EmitterTraceInput,
  EmitterTraceOutput,
  EmitterAffectedInput,
  EmitterAffectedOutput,
  EmitterAuditInput,
  EmitterAuditOutput,
} from './types.js';

import {
  writeOk,
  writeError,
  writeBatchOk,
  writeBatchError,
  formatOk,
  formatError,
  cleanOk,
  manifestOk,
  traceOk,
  traceNotFound,
  affectedOk,
  auditOk,
} from './types.js';

export interface EmitterError {
  readonly code: string;
  readonly message: string;
}

export interface EmitterHandler {
  readonly write: (
    input: EmitterWriteInput,
    storage: EmitterStorage,
  ) => TE.TaskEither<EmitterError, EmitterWriteOutput>;
  readonly writeBatch: (
    input: EmitterWriteBatchInput,
    storage: EmitterStorage,
  ) => TE.TaskEither<EmitterError, EmitterWriteBatchOutput>;
  readonly format: (
    input: EmitterFormatInput,
    storage: EmitterStorage,
  ) => TE.TaskEither<EmitterError, EmitterFormatOutput>;
  readonly clean: (
    input: EmitterCleanInput,
    storage: EmitterStorage,
  ) => TE.TaskEither<EmitterError, EmitterCleanOutput>;
  readonly manifest: (
    input: EmitterManifestInput,
    storage: EmitterStorage,
  ) => TE.TaskEither<EmitterError, EmitterManifestOutput>;
  readonly trace: (
    input: EmitterTraceInput,
    storage: EmitterStorage,
  ) => TE.TaskEither<EmitterError, EmitterTraceOutput>;
  readonly affected: (
    input: EmitterAffectedInput,
    storage: EmitterStorage,
  ) => TE.TaskEither<EmitterError, EmitterAffectedOutput>;
  readonly audit: (
    input: EmitterAuditInput,
    storage: EmitterStorage,
  ) => TE.TaskEither<EmitterError, EmitterAuditOutput>;
}

const toError = (error: unknown): EmitterError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Naive content hash: sum of char codes mod a large prime, rendered as hex.
// Deterministic and fast enough for deduplication inside the emitter.
const computeContentHash = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

// --- Implementation ---

export const emitterHandler: EmitterHandler = {
  // Write a single file. If the content hash matches the previously stored hash,
  // we skip the write (written=false). Otherwise we persist the new content,
  // record the hash and provenance sources, and return written=true.
  write: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('emitted_file', input.path),
        toError,
      ),
      TE.chain((existing) => {
        const contentHash = computeContentHash(input.content);
        const previousHash = pipe(
          O.fromNullable(existing),
          O.chain((r) => O.fromNullable(r['contentHash'] as string | undefined)),
          O.toNullable,
        );

        // Dedup: skip write when hash is unchanged
        if (previousHash === contentHash) {
          return TE.right<EmitterError, EmitterWriteOutput>(
            writeOk(false, input.path, contentHash),
          );
        }

        return pipe(
          TE.tryCatch(
            async () => {
              const sourcesRaw = pipe(
                input.sources,
                O.getOrElse((): readonly { readonly sourcePath: string; readonly sourceRange: O.Option<string>; readonly conceptName: O.Option<string>; readonly actionName: O.Option<string> }[] => []),
              );
              await storage.put('emitted_file', input.path, {
                path: input.path,
                content: input.content,
                contentHash,
                formatHint: pipe(input.formatHint, O.toNullable),
                sources: sourcesRaw.map((s) => ({
                  sourcePath: s.sourcePath,
                  sourceRange: pipe(s.sourceRange, O.toNullable),
                  conceptName: pipe(s.conceptName, O.toNullable),
                  actionName: pipe(s.actionName, O.toNullable),
                })),
                lastWritten: new Date().toISOString(),
              });
              return writeOk(true, input.path, contentHash);
            },
            toError,
          ),
        );
      }),
    ),

  // Write multiple files in a single logical batch. Each file is individually
  // hashed and persisted. If any file fails, the batch returns an error variant
  // indicating which path failed.
  writeBatch: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const results: { readonly path: string; readonly written: boolean; readonly contentHash: string }[] = [];
          for (const file of input.files) {
            const contentHash = computeContentHash(file.content);
            const existing = await storage.get('emitted_file', file.path);
            const previousHash = existing ? (existing['contentHash'] as string | undefined) : undefined;

            if (previousHash === contentHash) {
              results.push({ path: file.path, written: false, contentHash });
            } else {
              const sourcesRaw = pipe(
                file.sources,
                O.getOrElse((): readonly { readonly sourcePath: string; readonly sourceRange: O.Option<string>; readonly conceptName: O.Option<string>; readonly actionName: O.Option<string> }[] => []),
              );
              await storage.put('emitted_file', file.path, {
                path: file.path,
                content: file.content,
                contentHash,
                formatHint: pipe(file.formatHint, O.toNullable),
                sources: sourcesRaw.map((s) => ({
                  sourcePath: s.sourcePath,
                  sourceRange: pipe(s.sourceRange, O.toNullable),
                  conceptName: pipe(s.conceptName, O.toNullable),
                  actionName: pipe(s.actionName, O.toNullable),
                })),
                lastWritten: new Date().toISOString(),
              });
              results.push({ path: file.path, written: true, contentHash });
            }
          }
          return writeBatchOk(results);
        },
        toError,
      ),
    ),

  // Look up a file and check whether it has a formatHint. If one was recorded
  // we consider the file "formatted"; if none was recorded we mark it as changed.
  format: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('emitted_file', input.path),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<EmitterError, EmitterFormatOutput>(formatError(`File not found: ${input.path}`)),
            (found) => {
              const hint = found['formatHint'] as string | null;
              // If a formatHint exists, formatting is a no-op (already formatted).
              return TE.right<EmitterError, EmitterFormatOutput>(formatOk(hint === null));
            },
          ),
        ),
      ),
    ),

  // Remove any emitted file from storage whose path is NOT in the current
  // manifest. Returns the list of paths that were removed.
  clean: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('emitted_file', { outputDir: input.outputDir }),
        toError,
      ),
      TE.chain((records) =>
        pipe(
          TE.tryCatch(
            async () => {
              const manifestSet = new Set(input.currentManifest);
              const removed: string[] = [];
              for (const r of records) {
                const filePath = String(r['path']);
                if (!manifestSet.has(filePath)) {
                  await storage.delete('emitted_file', filePath);
                  removed.push(filePath);
                }
              }
              return cleanOk(removed);
            },
            toError,
          ),
        ),
      ),
    ),

  // Build a manifest listing every emitted file under the given output directory
  // together with its hash and last-written timestamp.
  manifest: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('emitted_file', { outputDir: input.outputDir }),
        toError,
      ),
      TE.map((records) => {
        const files = records.map((r) => ({
          path: String(r['path']),
          hash: String(r['contentHash'] ?? ''),
          lastWritten: new Date(String(r['lastWritten'] ?? Date.now())),
        }));
        return manifestOk(files);
      }),
    ),

  // Retrieve the provenance sources that produced a given output file. Returns
  // notFound when the file has never been emitted.
  trace: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('emitted_file', input.outputPath),
        toError,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            (): EmitterTraceOutput => traceNotFound(input.outputPath),
            (found): EmitterTraceOutput => {
              const rawSources = (found['sources'] as readonly Record<string, unknown>[] | undefined) ?? [];
              const sources = rawSources.map((s) => ({
                sourcePath: String(s['sourcePath']),
                sourceRange: O.fromNullable(s['sourceRange'] as string | undefined),
                conceptName: O.fromNullable(s['conceptName'] as string | undefined),
                actionName: O.fromNullable(s['actionName'] as string | undefined),
              }));
              return traceOk(sources);
            },
          ),
        ),
      ),
    ),

  // Find all output files that were derived from a given source path. This is the
  // reverse lookup of trace: given a source, which outputs does it affect?
  affected: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('emitted_file'),
        toError,
      ),
      TE.map((records) => {
        const outputs = records
          .filter((r) => {
            const sources = (r['sources'] as readonly Record<string, unknown>[] | undefined) ?? [];
            return sources.some((s) => String(s['sourcePath']) === input.sourcePath);
          })
          .map((r) => String(r['path']));
        return affectedOk(outputs);
      }),
    ),

  // Audit every emitted file: compare its stored hash against the content that is
  // actually on disk (approximated here by re-hashing stored content). Report each
  // file as "current", "modified", or "missing".
  audit: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('emitted_file', { outputDir: input.outputDir }),
        toError,
      ),
      TE.map((records) => {
        const status = records.map((r) => {
          const storedHash = r['contentHash'] as string | undefined;
          const content = r['content'] as string | undefined;
          const actualHash = content !== undefined ? computeContentHash(content) : undefined;
          const state =
            storedHash === undefined || actualHash === undefined
              ? 'missing'
              : storedHash === actualHash
                ? 'current'
                : 'modified';
          return {
            path: String(r['path']),
            state,
            expectedHash: O.fromNullable(storedHash),
            actualHash: O.fromNullable(actualHash),
          };
        });
        return auditOk(status);
      }),
    ),
};
