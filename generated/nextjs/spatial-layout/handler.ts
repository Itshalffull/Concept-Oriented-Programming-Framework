// SpatialLayout — Layout algorithm dispatch via provider pattern.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SpatialLayoutStorage,
  SpatialLayoutRegisterProviderInput,
  SpatialLayoutRegisterProviderOutput,
  SpatialLayoutApplyInput,
  SpatialLayoutApplyOutput,
  SpatialLayoutListProvidersInput,
  SpatialLayoutListProvidersOutput,
} from './types.js';

import {
  registerProviderOk,
  registerProviderAlreadyRegistered,
  applyOk,
  applyUnknownAlgorithm,
  listProvidersOk,
} from './types.js';

export interface SpatialLayoutError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): SpatialLayoutError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

let idCounter = 0;
function nextId(): string {
  return `layout-${++idCounter}`;
}

export interface SpatialLayoutHandler {
  readonly registerProvider: (
    input: SpatialLayoutRegisterProviderInput,
    storage: SpatialLayoutStorage,
  ) => TE.TaskEither<SpatialLayoutError, SpatialLayoutRegisterProviderOutput>;
  readonly apply: (
    input: SpatialLayoutApplyInput,
    storage: SpatialLayoutStorage,
  ) => TE.TaskEither<SpatialLayoutError, SpatialLayoutApplyOutput>;
  readonly listProviders: (
    input: SpatialLayoutListProvidersInput,
    storage: SpatialLayoutStorage,
  ) => TE.TaskEither<SpatialLayoutError, SpatialLayoutListProvidersOutput>;
}

// --- Implementation ---

export const spatialLayoutHandler: SpatialLayoutHandler = {
  registerProvider: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('layout_algorithm', input.algorithm),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('layout_algorithm', input.algorithm, {
                    algorithm: input.algorithm,
                    provider: input.provider,
                    createdAt: now,
                  });
                  return registerProviderOk();
                },
                toStorageError,
              ),
            () =>
              TE.right(
                registerProviderAlreadyRegistered(
                  `Algorithm '${input.algorithm}' already has a registered provider`,
                ),
              ),
          ),
        ),
      ),
    ),

  apply: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('layout_algorithm', input.algorithm),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                applyUnknownAlgorithm(
                  `Algorithm '${input.algorithm}' is not registered`,
                ),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const id = nextId();
                  const now = new Date().toISOString();
                  await storage.put('layout', id, {
                    id,
                    canvas: input.canvas,
                    algorithm: input.algorithm,
                    provider: String(existing['provider']),
                    appliedAt: now,
                  });
                  return applyOk(id);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  listProviders: (_input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('layout_algorithm'),
        toStorageError,
      ),
      TE.map((records) => listProvidersOk(JSON.stringify(records))),
    ),
};
