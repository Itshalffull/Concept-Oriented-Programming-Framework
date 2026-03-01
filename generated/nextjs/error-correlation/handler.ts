// ErrorCorrelation — handler.ts
// Error fingerprinting, grouping of similar errors, and frequency-based hotspot tracking.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import { pipe } from 'fp-ts/function';

import type {
  ErrorCorrelationStorage,
  ErrorCorrelationRecordInput,
  ErrorCorrelationRecordOutput,
  ErrorCorrelationFindByEntityInput,
  ErrorCorrelationFindByEntityOutput,
  ErrorCorrelationFindByKindInput,
  ErrorCorrelationFindByKindOutput,
  ErrorCorrelationErrorHotspotsInput,
  ErrorCorrelationErrorHotspotsOutput,
  ErrorCorrelationRootCauseInput,
  ErrorCorrelationRootCauseOutput,
  ErrorCorrelationGetInput,
  ErrorCorrelationGetOutput,
} from './types.js';

import {
  recordOk,
  findByEntityOk,
  findByKindOk,
  errorHotspotsOk,
  rootCauseOk,
  rootCauseInconclusive,
  getOk,
  getNotfound,
} from './types.js';

export interface ErrorCorrelationError {
  readonly code: string;
  readonly message: string;
}

const toError = (error: unknown): ErrorCorrelationError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Compute a stable fingerprint by normalizing the error message (strip digits, collapse whitespace)
const fingerprint = (errorKind: string, message: string): string => {
  const normalized = message.replace(/\d+/g, 'N').replace(/\s+/g, ' ').trim();
  return `${errorKind}::${normalized}`;
};

export interface ErrorCorrelationHandler {
  readonly record: (
    input: ErrorCorrelationRecordInput,
    storage: ErrorCorrelationStorage,
  ) => TE.TaskEither<ErrorCorrelationError, ErrorCorrelationRecordOutput>;
  readonly findByEntity: (
    input: ErrorCorrelationFindByEntityInput,
    storage: ErrorCorrelationStorage,
  ) => TE.TaskEither<ErrorCorrelationError, ErrorCorrelationFindByEntityOutput>;
  readonly findByKind: (
    input: ErrorCorrelationFindByKindInput,
    storage: ErrorCorrelationStorage,
  ) => TE.TaskEither<ErrorCorrelationError, ErrorCorrelationFindByKindOutput>;
  readonly errorHotspots: (
    input: ErrorCorrelationErrorHotspotsInput,
    storage: ErrorCorrelationStorage,
  ) => TE.TaskEither<ErrorCorrelationError, ErrorCorrelationErrorHotspotsOutput>;
  readonly rootCause: (
    input: ErrorCorrelationRootCauseInput,
    storage: ErrorCorrelationStorage,
  ) => TE.TaskEither<ErrorCorrelationError, ErrorCorrelationRootCauseOutput>;
  readonly get: (
    input: ErrorCorrelationGetInput,
    storage: ErrorCorrelationStorage,
  ) => TE.TaskEither<ErrorCorrelationError, ErrorCorrelationGetOutput>;
}

// --- Implementation ---

export const errorCorrelationHandler: ErrorCorrelationHandler = {
  // Record a new error event with fingerprinting and timestamp
  record: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const errorId = fingerprint(input.errorKind, input.message);
          const timestamp = new Date().toISOString();
          const existing = await storage.get('error', errorId);
          const count = pipe(
            O.fromNullable(existing),
            O.fold(
              () => 1,
              (rec) => ((rec as { readonly count?: number }).count ?? 0) + 1,
            ),
          );
          await storage.put('error', errorId, {
            errorId,
            flowId: input.flowId,
            errorKind: input.errorKind,
            message: input.message,
            rawEvent: input.rawEvent,
            timestamp,
            count,
          });
          return recordOk(errorId);
        },
        toError,
      ),
    ),

  // Find all errors associated with a given entity symbol, filtered by timestamp
  findByEntity: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const all = await storage.find('error', { flowId: input.symbol });
          const filtered = all.filter((rec) => {
            const ts = rec.timestamp as string | undefined;
            return ts !== undefined && ts >= input.since;
          });
          return findByEntityOk(JSON.stringify(filtered.map((r) => r.errorId)));
        },
        toError,
      ),
    ),

  // Find all errors of a specific kind since a given timestamp
  findByKind: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const all = await storage.find('error', { errorKind: input.errorKind });
          const filtered = all.filter((rec) => {
            const ts = rec.timestamp as string | undefined;
            return ts !== undefined && ts >= input.since;
          });
          return findByKindOk(JSON.stringify(filtered.map((r) => r.errorId)));
        },
        toError,
      ),
    ),

  // Rank the top-N error fingerprints by frequency since a given timestamp
  errorHotspots: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const all = await storage.find('error');
          const recent = all.filter((rec) => {
            const ts = rec.timestamp as string | undefined;
            return ts !== undefined && ts >= input.since;
          });
          // Sort by descending count, take topN
          const sorted = [...recent].sort(
            (a, b) => ((b.count as number) ?? 0) - ((a.count as number) ?? 0),
          );
          const topN = sorted.slice(0, input.topN);
          return errorHotspotsOk(
            JSON.stringify(topN.map((r) => ({ errorId: r.errorId, count: r.count, errorKind: r.errorKind }))),
          );
        },
        toError,
      ),
    ),

  // Walk the causal chain: follow flowId references to find the root cause
  rootCause: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('error', input.error),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(rootCauseInconclusive(JSON.stringify([]))),
            (found) =>
              TE.tryCatch(
                async () => {
                  // Walk chain by following flowId as a pointer to a parent error
                  let chain: readonly string[] = [input.error];
                  const visited = new Set<string>([input.error]);
                  let current = found;
                  // eslint-disable-next-line no-constant-condition
                  while (true) {
                    const parentId = current.flowId as string | undefined;
                    if (!parentId || visited.has(parentId)) break;
                    const parent = await storage.get('error', parentId);
                    if (!parent) break;
                    visited.add(parentId);
                    chain = [...chain, parentId];
                    current = parent;
                  }
                  const likelyCause = chain[chain.length - 1] ?? input.error;
                  const source = (current.errorKind as string) ?? 'unknown';
                  return rootCauseOk(JSON.stringify(chain), likelyCause, source);
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  // Retrieve a single error record by its fingerprint id
  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('error', input.error),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound()),
            (found) =>
              TE.right(
                getOk(
                  input.error,
                  (found.flowId as string) ?? '',
                  (found.errorKind as string) ?? '',
                  (found.message as string) ?? '',
                  (found.timestamp as string) ?? '',
                ),
              ),
          ),
        ),
      ),
    ),
};
