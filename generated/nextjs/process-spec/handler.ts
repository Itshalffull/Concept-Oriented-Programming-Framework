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
  create: (input, storage) => {
    const specId = (input as any).spec_id ?? (input as any).spec ?? `spec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const name = (input as any).name ?? '';
    const steps = (input as any).steps ?? '';
    const edges = (input as any).edges ?? '';
    const definition = (input as any).definition ?? '';
    const version = (input as any).version ?? 1;

    return pipe(
      TE.tryCatch(
        () => storage.get('process_specs', specId),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(async () => {
                const now = new Date().toISOString();
                const newSpecId = `spec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await storage.put('process_specs', newSpecId, {
                  spec: newSpecId,
                  spec_id: newSpecId,
                  name,
                  steps,
                  edges,
                  definition,
                  version: 1,
                  status: 'draft',
                  revision: 1,
                  created_at: now,
                  updated_at: now,
                });
                return { variant: 'ok' as const, spec: newSpecId, status: 'draft' } as any as ProcessSpecCreateOutput;
              }, storageError),
            () => TE.right(createAlreadyExists(specId) as ProcessSpecCreateOutput),
          ),
        ),
      ),
    );
  },

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

  get: (input, storage) => {
    const specId = (input as any).spec ?? (input as any).spec_id ?? '';
    return pipe(
      TE.tryCatch(
        () => storage.get('process_specs', specId),
        storageError,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => getNotFound(specId),
            (spec) => ({
              variant: 'ok' as const,
              spec: specId,
              name: String(spec.name ?? ''),
              version: spec.version ?? 1,
              status: String(spec.status ?? ''),
              steps: spec.steps ?? '',
              edges: spec.edges ?? '',
              definition: spec.definition ?? '',
              revision: spec.revision ?? 1,
            } as any),
          ),
        ),
      ),
    );
  },
};
