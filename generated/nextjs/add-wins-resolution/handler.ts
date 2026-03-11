import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { AddWinsResolutionStorage, AddWinsResolutionRegisterInput, AddWinsResolutionRegisterOutput, AddWinsResolutionAttemptResolveInput, AddWinsResolutionAttemptResolveOutput } from './types.js';
import { registerOk, attemptResolveResolved, attemptResolveCannotResolve } from './types.js';
export interface AddWinsResolutionError { readonly code: string; readonly message: string; }
export interface AddWinsResolutionHandler {
  readonly register: (input: AddWinsResolutionRegisterInput, storage: AddWinsResolutionStorage) => TE.TaskEither<AddWinsResolutionError, AddWinsResolutionRegisterOutput>;
  readonly attemptResolve: (input: AddWinsResolutionAttemptResolveInput, storage: AddWinsResolutionStorage) => TE.TaskEither<AddWinsResolutionError, AddWinsResolutionAttemptResolveOutput>;
}
const err = (error: unknown): AddWinsResolutionError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });
export const addWinsResolutionHandler: AddWinsResolutionHandler = {
  register: (_input, _storage) => pipe(TE.tryCatch(async () => registerOk('add-wins', 'conflict-resolution', 20), err)),
  attemptResolve: (input, _storage) => pipe(TE.tryCatch(async () => {
    const isBuffer = (v: unknown): v is Buffer => Buffer.isBuffer(v);
    if (!isBuffer(input.v1) || !isBuffer(input.v2)) {
      // Non-buffer inputs: treat as scalar values, produce deterministic union
      const vals = [...new Set([String(input.v1), String(input.v2)])].sort();
      const merged = JSON.stringify(vals);
      return { variant: 'resolved' as const, result: merged } as any;
    }
    let arr1: unknown, arr2: unknown;
    try { arr1 = JSON.parse(input.v1.toString('utf-8')); } catch { return attemptResolveCannotResolve('v1 is not valid JSON'); }
    try { arr2 = JSON.parse(input.v2.toString('utf-8')); } catch { return attemptResolveCannotResolve('v2 is not valid JSON'); }
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) return attemptResolveCannotResolve('inputs are not arrays');
    const union = [...new Set([...arr1, ...arr2])];
    return attemptResolveResolved(Buffer.from(JSON.stringify(union)));
  }, err)),
};
