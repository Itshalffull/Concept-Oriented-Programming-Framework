// ProcessVariable — Scoped key-value store for process run state.
// Variables are keyed by composite run_ref::name for isolation between process runs.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ProcessVariableStorage,
  ProcessVariableSetInput,
  ProcessVariableSetOutput,
  ProcessVariableGetInput,
  ProcessVariableGetOutput,
  ProcessVariableMergeInput,
  ProcessVariableMergeOutput,
  ProcessVariableDeleteInput,
  ProcessVariableDeleteOutput,
  ProcessVariableListInput,
  ProcessVariableListOutput,
  ProcessVariableSnapshotInput,
  ProcessVariableSnapshotOutput,
} from './types.js';

import {
  setOk,
  getOk,
  getNotFound,
  mergeOk,
  mergeNotFound,
  deleteOk,
  deleteNotFound,
  listOk,
  snapshotOk,
} from './types.js';

export interface ProcessVariableError {
  readonly code: string;
  readonly message: string;
}

export interface ProcessVariableHandler {
  readonly set: (input: ProcessVariableSetInput, storage: ProcessVariableStorage) => TE.TaskEither<ProcessVariableError, ProcessVariableSetOutput>;
  readonly get: (input: ProcessVariableGetInput, storage: ProcessVariableStorage) => TE.TaskEither<ProcessVariableError, ProcessVariableGetOutput>;
  readonly merge: (input: ProcessVariableMergeInput, storage: ProcessVariableStorage) => TE.TaskEither<ProcessVariableError, ProcessVariableMergeOutput>;
  readonly delete: (input: ProcessVariableDeleteInput, storage: ProcessVariableStorage) => TE.TaskEither<ProcessVariableError, ProcessVariableDeleteOutput>;
  readonly list: (input: ProcessVariableListInput, storage: ProcessVariableStorage) => TE.TaskEither<ProcessVariableError, ProcessVariableListOutput>;
  readonly snapshot: (input: ProcessVariableSnapshotInput, storage: ProcessVariableStorage) => TE.TaskEither<ProcessVariableError, ProcessVariableSnapshotOutput>;
}

const storageError = (error: unknown): ProcessVariableError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const compositeKey = (run_ref: string, name: string): string => `${run_ref}::${name}`;

export const processVariableHandler: ProcessVariableHandler = {
  set: (input, storage) =>
    pipe(
      TE.tryCatch(async () => {
        const key = compositeKey(input.run_ref, input.name);
        const existing = await storage.get('process_variables', key);
        const version = existing
          ? (typeof existing.version === 'number' ? existing.version + 1 : 1)
          : 1;
        const varType = (input as any).value_type ?? (input as any).var_type ?? '';
        const scope = (input as any).scope ?? '';

        await storage.put('process_variables', key, {
          run_ref: input.run_ref,
          name: input.name,
          value: input.value,
          var_type: varType,
          value_type: varType,
          scope,
          version,
          updated_at: new Date().toISOString(),
        });

        return { variant: 'ok' as const, var: key, version } as any;
      }, storageError),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('process_variables', compositeKey(input.run_ref, input.name)),
        storageError,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => getNotFound(compositeKey(input.run_ref, input.name)),
            (r) => ({
              variant: 'ok' as const,
              var: compositeKey(input.run_ref, input.name),
              value: r.value,
              value_type: String(r.value_type ?? r.var_type ?? ''),
              var_type: String(r.var_type ?? r.value_type ?? ''),
              version: r.version,
            } as any),
          ),
        ),
      ),
    ),

  merge: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('process_variables', compositeKey(input.run_ref, input.name)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(mergeNotFound(compositeKey(input.run_ref, input.name)) as ProcessVariableMergeOutput),
            (existing) =>
              TE.tryCatch(async () => {
                const key = compositeKey(input.run_ref, input.name);
                const existingValue = JSON.parse(existing.value as string);
                const partialValue = JSON.parse(input.partial_value);
                const merged = { ...existingValue, ...partialValue };
                const nextVersion = (typeof existing.version === 'number' ? existing.version + 1 : 1);

                await storage.put('process_variables', key, {
                  run_ref: input.run_ref,
                  name: input.name,
                  value: JSON.stringify(merged),
                  var_type: existing.var_type,
                  version: nextVersion,
                  updated_at: new Date().toISOString(),
                });

                return mergeOk(key, nextVersion) as ProcessVariableMergeOutput;
              }, storageError),
          ),
        ),
      ),
    ),

  delete: (input, storage) =>
    pipe(
      TE.tryCatch(async () => {
        const key = compositeKey(input.run_ref, input.name);
        const existed = await storage.delete('process_variables', key);
        if (!existed) {
          return deleteNotFound(key);
        }
        return deleteOk(key);
      }, storageError),
    ),

  list: (input, storage) =>
    pipe(
      TE.tryCatch(async () => {
        const allVars = await storage.find('process_variables');
        const all = allVars.filter((v) => String(v.run_ref ?? '') === input.run_ref);
        const summaries = all.map((v) => ({
          name: v.name,
          var_type: v.var_type,
          version: v.version,
        }));
        return listOk(JSON.stringify(summaries), summaries.length);
      }, storageError),
    ),

  snapshot: (input, storage) =>
    pipe(
      TE.tryCatch(async () => {
        const allVarsSnap = await storage.find('process_variables');
        const all = allVarsSnap.filter((v) => String(v.run_ref ?? '') === input.run_ref);
        const now = new Date().toISOString();
        const snap = all.map((v) => ({
          name: v.name,
          value: v.value,
          var_type: v.var_type,
          version: v.version,
        }));
        return snapshotOk(JSON.stringify(snap), snap.length, now);
      }, storageError),
    ),
};
