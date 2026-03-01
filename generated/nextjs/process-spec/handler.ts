// ProcessSpec — Blueprint definitions for process execution.
// Enforces the status lifecycle: draft -> active -> deprecated.
// Only draft specs can be updated; publish and deprecate are one-way transitions.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ProcessSpecStorage,
  ProcessSpecCreateInput,
  ProcessSpecCreateOutput,
  ProcessSpecPublishInput,
  ProcessSpecPublishOutput,
  ProcessSpecDeprecateInput,
  ProcessSpecDeprecateOutput,
  ProcessSpecUpdateInput,
  ProcessSpecUpdateOutput,
  ProcessSpecGetInput,
  ProcessSpecGetOutput,
} from './types.js';

import {
  createOk,
  createAlreadyExists,
  publishOk,
  publishNotFound,
  publishInvalidTransition,
  deprecateOk,
  deprecateNotFound,
  deprecateInvalidTransition,
  updateOk,
  updateNotFound,
  updateNotDraft,
  getOk,
  getNotFound,
} from './types.js';

export interface ProcessSpecError {
  readonly code: string;
  readonly message: string;
}

export interface ProcessSpecHandler {
  readonly create: (input: ProcessSpecCreateInput, storage: ProcessSpecStorage) => TE.TaskEither<ProcessSpecError, ProcessSpecCreateOutput>;
  readonly publish: (input: ProcessSpecPublishInput, storage: ProcessSpecStorage) => TE.TaskEither<ProcessSpecError, ProcessSpecPublishOutput>;
  readonly deprecate: (input: ProcessSpecDeprecateInput, storage: ProcessSpecStorage) => TE.TaskEither<ProcessSpecError, ProcessSpecDeprecateOutput>;
  readonly update: (input: ProcessSpecUpdateInput, storage: ProcessSpecStorage) => TE.TaskEither<ProcessSpecError, ProcessSpecUpdateOutput>;
  readonly get: (input: ProcessSpecGetInput, storage: ProcessSpecStorage) => TE.TaskEither<ProcessSpecError, ProcessSpecGetOutput>;
}

const storageError = (error: unknown): ProcessSpecError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export const processSpecHandler: ProcessSpecHandler = {
  create: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('process_specs', input.spec_id),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(async () => {
                const now = new Date().toISOString();
                await storage.put('process_specs', input.spec_id, {
                  spec_id: input.spec_id,
                  name: input.name,
                  definition: input.definition,
                  version: input.version,
                  status: 'draft',
                  revision: 1,
                  created_at: now,
                  updated_at: now,
                });
                return createOk(input.spec_id, 'draft') as ProcessSpecCreateOutput;
              }, storageError),
            () => TE.right(createAlreadyExists(input.spec_id) as ProcessSpecCreateOutput),
          ),
        ),
      ),
    ),

  publish: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('process_specs', input.spec_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(publishNotFound(input.spec_id) as ProcessSpecPublishOutput),
            (spec) => {
              if (spec.status !== 'draft') {
                return TE.right(publishInvalidTransition(input.spec_id, spec.status as string) as ProcessSpecPublishOutput);
              }
              return TE.tryCatch(async () => {
                await storage.put('process_specs', input.spec_id, {
                  ...spec,
                  status: 'active',
                  published_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return publishOk(input.spec_id, 'active') as ProcessSpecPublishOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  deprecate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('process_specs', input.spec_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(deprecateNotFound(input.spec_id) as ProcessSpecDeprecateOutput),
            (spec) => {
              if (spec.status !== 'active') {
                return TE.right(deprecateInvalidTransition(input.spec_id, spec.status as string) as ProcessSpecDeprecateOutput);
              }
              return TE.tryCatch(async () => {
                await storage.put('process_specs', input.spec_id, {
                  ...spec,
                  status: 'deprecated',
                  deprecation_reason: input.reason,
                  deprecated_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return deprecateOk(input.spec_id, 'deprecated') as ProcessSpecDeprecateOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  update: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('process_specs', input.spec_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(updateNotFound(input.spec_id) as ProcessSpecUpdateOutput),
            (spec) => {
              if (spec.status !== 'draft') {
                return TE.right(updateNotDraft(input.spec_id, spec.status as string) as ProcessSpecUpdateOutput);
              }
              return TE.tryCatch(async () => {
                const nextRevision = (typeof spec.revision === 'number' ? spec.revision + 1 : 1);
                await storage.put('process_specs', input.spec_id, {
                  ...spec,
                  definition: input.definition,
                  revision: nextRevision,
                  updated_at: new Date().toISOString(),
                });
                return updateOk(input.spec_id, nextRevision) as ProcessSpecUpdateOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('process_specs', input.spec_id),
        storageError,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => getNotFound(input.spec_id),
            (spec) =>
              getOk(
                spec.spec_id as string,
                spec.name as string,
                spec.definition as string,
                spec.version as string,
                spec.status as string,
                spec.revision as number,
              ),
          ),
        ),
      ),
    ),
};
