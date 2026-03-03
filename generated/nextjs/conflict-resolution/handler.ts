import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ConflictResolutionStorage, ConflictResolutionDetectInput, ConflictResolutionDetectOutput, ConflictResolutionResolveInput, ConflictResolutionResolveOutput } from './types.js';
import { detectNoConflict, resolveResolved } from './types.js';

export interface ConflictResolutionError { readonly code: string; readonly message: string; }
export interface ConflictResolutionHandler {
  readonly detect: (input: ConflictResolutionDetectInput, storage: ConflictResolutionStorage) => TE.TaskEither<ConflictResolutionError, ConflictResolutionDetectOutput>;
  readonly resolve: (input: ConflictResolutionResolveInput, storage: ConflictResolutionStorage) => TE.TaskEither<ConflictResolutionError, ConflictResolutionResolveOutput>;
}

const err = (error: unknown): ConflictResolutionError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const conflictResolutionHandler: ConflictResolutionHandler = {
  detect: (input, _storage) => pipe(TE.tryCatch(async () => {
    return detectNoConflict();
  }, err)),
  resolve: (input, _storage) => pipe(TE.tryCatch(async () => {
    return resolveResolved('auto-resolved');
  }, err)),
};
