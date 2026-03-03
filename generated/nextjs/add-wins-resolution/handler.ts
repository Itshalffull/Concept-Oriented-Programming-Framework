import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { AddWinsResolutionStorage, AddWinsResolutionRegisterInput, AddWinsResolutionRegisterOutput, AddWinsResolutionAttemptResolveInput, AddWinsResolutionAttemptResolveOutput } from './types.js';
import { registerOk, attemptResolveResolved } from './types.js';
export interface AddWinsResolutionError { readonly code: string; readonly message: string; }
export interface AddWinsResolutionHandler {
  readonly register: (input: AddWinsResolutionRegisterInput, storage: AddWinsResolutionStorage) => TE.TaskEither<AddWinsResolutionError, AddWinsResolutionRegisterOutput>;
  readonly attemptResolve: (input: AddWinsResolutionAttemptResolveInput, storage: AddWinsResolutionStorage) => TE.TaskEither<AddWinsResolutionError, AddWinsResolutionAttemptResolveOutput>;
}
const err = (error: unknown): AddWinsResolutionError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });
export const addWinsResolutionHandler: AddWinsResolutionHandler = {
  register: (input, _storage) => pipe(TE.tryCatch(async () => registerOk('add-wins', 'resolution', 0), err)),
  attemptResolve: (input, _storage) => pipe(TE.tryCatch(async () => {
    const sorted = [String(input.v1), String(input.v2)].sort();
    return attemptResolveResolved(sorted.join(',') as any);
  }, err)),
};
