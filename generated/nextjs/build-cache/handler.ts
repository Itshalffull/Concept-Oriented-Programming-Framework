import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import type { BuildCacheStorage, BuildCacheRecordInput, BuildCacheRecordOutput, BuildCacheCheckInput, BuildCacheCheckOutput, BuildCacheInvalidateInput, BuildCacheInvalidateOutput } from './types.js';
import { recordOk, checkUnchanged, checkChanged, invalidateOk } from './types.js';

export interface BuildCacheError { readonly code: string; readonly message: string; }
export interface BuildCacheHandler {
  readonly record: (input: BuildCacheRecordInput, storage: BuildCacheStorage) => TE.TaskEither<BuildCacheError, BuildCacheRecordOutput>;
  readonly check: (input: BuildCacheCheckInput, storage: BuildCacheStorage) => TE.TaskEither<BuildCacheError, BuildCacheCheckOutput>;
  readonly invalidate: (input: BuildCacheInvalidateInput, storage: BuildCacheStorage) => TE.TaskEither<BuildCacheError, BuildCacheInvalidateOutput>;
}

let _entryCounter = 0;
const err = (error: unknown): BuildCacheError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const buildCacheHandler: BuildCacheHandler = {
  record: (input, storage) => pipe(TE.tryCatch(async () => {
    _entryCounter++;
    const entry = `entry-${_entryCounter}`;
    const now = new Date();
    await storage.put('cache', input.stepKey, {
      entry, stepKey: input.stepKey, inputHash: input.inputHash,
      outputHash: input.outputHash, outputRef: input.outputRef,
      sourceLocator: input.sourceLocator, deterministic: input.deterministic,
      lastRun: now.toISOString(),
    });
    return recordOk(entry);
  }, err)),
  check: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('cache', input.stepKey);
    if (!record) {
      return checkChanged(input.inputHash as any);
    }
    const storedHash = String(record.inputHash ?? '');
    if (storedHash === input.inputHash) {
      return checkUnchanged(record.lastRun as any, record.outputRef as any);
    }
    return checkChanged(storedHash as any);
  }, err)),
  invalidate: (input, storage) => pipe(TE.tryCatch(async () => {
    await storage.delete('cache', input.stepKey);
    return invalidateOk();
  }, err)),
};
