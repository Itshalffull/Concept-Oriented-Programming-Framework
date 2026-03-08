// SpatialConnector — Typed connections between spatial items with visual/semantic promotion.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SpatialConnectorStorage,
  SpatialConnectorDrawInput,
  SpatialConnectorDrawOutput,
  SpatialConnectorPromoteInput,
  SpatialConnectorPromoteOutput,
  SpatialConnectorDemoteInput,
  SpatialConnectorDemoteOutput,
  SpatialConnectorSurfaceInput,
  SpatialConnectorSurfaceOutput,
  SpatialConnectorHideInput,
  SpatialConnectorHideOutput,
  SpatialConnectorListInput,
  SpatialConnectorListOutput,
  SpatialConnectorDeleteInput,
  SpatialConnectorDeleteOutput,
} from './types.js';

import {
  drawOk,
  drawNotfound,
  promoteOk,
  promoteAlreadySemantic,
  demoteOk,
  demoteNotSemantic,
  surfaceOk,
  surfaceNoReference,
  hideOk,
  hideNotfound,
  listOk,
  deleteOk,
  deleteNotfound,
} from './types.js';

export interface SpatialConnectorError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): SpatialConnectorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

let idCounter = 0;
function nextId(): string {
  return `connector-${++idCounter}`;
}

export interface SpatialConnectorHandler {
  readonly draw: (
    input: SpatialConnectorDrawInput,
    storage: SpatialConnectorStorage,
  ) => TE.TaskEither<SpatialConnectorError, SpatialConnectorDrawOutput>;
  readonly promote: (
    input: SpatialConnectorPromoteInput,
    storage: SpatialConnectorStorage,
  ) => TE.TaskEither<SpatialConnectorError, SpatialConnectorPromoteOutput>;
  readonly demote: (
    input: SpatialConnectorDemoteInput,
    storage: SpatialConnectorStorage,
  ) => TE.TaskEither<SpatialConnectorError, SpatialConnectorDemoteOutput>;
  readonly surface: (
    input: SpatialConnectorSurfaceInput,
    storage: SpatialConnectorStorage,
  ) => TE.TaskEither<SpatialConnectorError, SpatialConnectorSurfaceOutput>;
  readonly hide: (
    input: SpatialConnectorHideInput,
    storage: SpatialConnectorStorage,
  ) => TE.TaskEither<SpatialConnectorError, SpatialConnectorHideOutput>;
  readonly list: (
    input: SpatialConnectorListInput,
    storage: SpatialConnectorStorage,
  ) => TE.TaskEither<SpatialConnectorError, SpatialConnectorListOutput>;
  readonly delete: (
    input: SpatialConnectorDeleteInput,
    storage: SpatialConnectorStorage,
  ) => TE.TaskEither<SpatialConnectorError, SpatialConnectorDeleteOutput>;
}

// --- Implementation ---

export const spatialConnectorHandler: SpatialConnectorHandler = {
  draw: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const id = nextId();
          const now = new Date().toISOString();
          await storage.put('connector', id, {
            id,
            canvas: input.canvas,
            source: input.source,
            target: input.target,
            type: input.type,
            label: null,
            createdAt: now,
            updatedAt: now,
          });
          return drawOk(id);
        },
        toStorageError,
      ),
    ),

  promote: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('connector', input.connector),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                drawNotfound(`Connector '${input.connector}' not found`) as unknown as SpatialConnectorPromoteOutput,
              ),
            (existing) => {
              const type = String(existing['type']);
              if (type === 'semantic' || type === 'surfaced') {
                return TE.right(
                  promoteAlreadySemantic(
                    `Connector '${input.connector}' is already ${type}`,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('connector', input.connector, {
                    ...existing,
                    type: 'semantic',
                    updatedAt: now,
                  });
                  return promoteOk();
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  demote: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('connector', input.connector),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                demoteNotSemantic(`Connector '${input.connector}' not found`) as SpatialConnectorDemoteOutput,
              ),
            (existing) => {
              const type = String(existing['type']);
              if (type !== 'semantic') {
                return TE.right(
                  demoteNotSemantic(
                    `Connector '${input.connector}' is not semantic (current: ${type})`,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('connector', input.connector, {
                    ...existing,
                    type: 'visual',
                    updatedAt: now,
                  });
                  return demoteOk();
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  surface: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('reference', { source: input.source, target: input.target }),
        toStorageError,
      ),
      TE.chain((refs) => {
        if (refs.length === 0) {
          return TE.right(
            surfaceNoReference(
              `No reference found between '${input.source}' and '${input.target}'`,
            ),
          );
        }
        return TE.tryCatch(
          async () => {
            const id = nextId();
            const now = new Date().toISOString();
            await storage.put('connector', id, {
              id,
              canvas: input.canvas,
              source: input.source,
              target: input.target,
              type: 'surfaced',
              label: null,
              createdAt: now,
              updatedAt: now,
            });
            return surfaceOk(id);
          },
          toStorageError,
        );
      }),
    ),

  hide: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('connector', input.connector),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                hideNotfound(`Connector '${input.connector}' not found`),
              ),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('connector', input.connector);
                  return hideOk();
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  list: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('connector', input.canvas ? { canvas: input.canvas } : undefined),
        toStorageError,
      ),
      TE.map((records) => listOk(JSON.stringify(records))),
    ),

  delete: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('connector', input.connector),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                deleteNotfound(`Connector '${input.connector}' not found`),
              ),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('connector', input.connector);
                  return deleteOk();
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),
};
