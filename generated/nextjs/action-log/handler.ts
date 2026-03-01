// ActionLog concept handler — audit log recording with append-only entries,
// edge tracking between log nodes, and query/filtering by flow.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ActionLogStorage,
  ActionLogAppendInput,
  ActionLogAppendOutput,
  ActionLogAddEdgeInput,
  ActionLogAddEdgeOutput,
  ActionLogQueryInput,
  ActionLogQueryOutput,
} from './types.js';

import {
  appendOk,
  addEdgeOk,
  queryOk,
} from './types.js';

export interface ActionLogError {
  readonly code: string;
  readonly message: string;
}

export interface ActionLogHandler {
  readonly append: (
    input: ActionLogAppendInput,
    storage: ActionLogStorage,
  ) => TE.TaskEither<ActionLogError, ActionLogAppendOutput>;
  readonly addEdge: (
    input: ActionLogAddEdgeInput,
    storage: ActionLogStorage,
  ) => TE.TaskEither<ActionLogError, ActionLogAddEdgeOutput>;
  readonly query: (
    input: ActionLogQueryInput,
    storage: ActionLogStorage,
  ) => TE.TaskEither<ActionLogError, ActionLogQueryOutput>;
}

// --- Pure helpers ---

const generateEntryId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `log_${timestamp}_${randomPart}`;
};

const normalizeRecord = (record: unknown): Record<string, unknown> => {
  if (record !== null && typeof record === 'object' && !Array.isArray(record)) {
    return record as Record<string, unknown>;
  }
  return { value: record };
};

const toStorageError = (error: unknown): ActionLogError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const actionLogHandler: ActionLogHandler = {
  append: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const id = generateEntryId();
          const now = new Date().toISOString();
          const normalized = normalizeRecord(input.record);

          await storage.put('actionlog', id, {
            id,
            ...normalized,
            appendedAt: now,
          });

          return appendOk(id);
        },
        toStorageError,
      ),
    ),

  addEdge: (input, storage) =>
    pipe(
      // Verify both source and target log entries exist
      TE.tryCatch(
        () => storage.get('actionlog', input.from),
        toStorageError,
      ),
      TE.chain((fromRecord) =>
        pipe(
          O.fromNullable(fromRecord),
          O.fold(
            () =>
              TE.left({
                code: 'NOT_FOUND',
                message: `Source log entry '${input.from}' not found`,
              } as ActionLogError),
            () =>
              pipe(
                TE.tryCatch(
                  () => storage.get('actionlog', input.to),
                  toStorageError,
                ),
                TE.chain((toRecord) =>
                  pipe(
                    O.fromNullable(toRecord),
                    O.fold(
                      () =>
                        TE.left({
                          code: 'NOT_FOUND',
                          message: `Target log entry '${input.to}' not found`,
                        } as ActionLogError),
                      () =>
                        TE.tryCatch(
                          async () => {
                            const edgeKey = `${input.from}:${input.to}`;
                            const now = new Date().toISOString();

                            await storage.put('edge', edgeKey, {
                              from: input.from,
                              to: input.to,
                              sync: input.sync,
                              createdAt: now,
                            });

                            return addEdgeOk();
                          },
                          toStorageError,
                        ),
                    ),
                  ),
                ),
              ),
          ),
        ),
      ),
    ),

  query: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Find all edges belonging to this flow
          const edges = await storage.find('edge', { sync: input.flow });

          // Collect all unique node IDs referenced by edges in this flow
          const nodeIds = new Set<string>();
          for (const edge of edges) {
            if (typeof edge['from'] === 'string') {
              nodeIds.add(edge['from'] as string);
            }
            if (typeof edge['to'] === 'string') {
              nodeIds.add(edge['to'] as string);
            }
          }

          // If no edges found, try finding log entries directly
          if (nodeIds.size === 0) {
            const allRecords = await storage.find('actionlog', { flow: input.flow });
            return queryOk(allRecords);
          }

          // Fetch each referenced log entry
          const records: readonly Record<string, unknown>[] = await Promise.all(
            Array.from(nodeIds).map((nodeId) => storage.get('actionlog', nodeId)),
          ).then((results) =>
            results.filter((r): r is Record<string, unknown> => r !== null),
          );

          return queryOk(records);
        },
        toStorageError,
      ),
    ),
};
