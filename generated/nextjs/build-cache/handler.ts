import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import type { BuildCacheStorage, BuildCacheRecordInput, BuildCacheRecordOutput, BuildCacheCheckInput, BuildCacheCheckOutput, BuildCacheInvalidateInput, BuildCacheInvalidateOutput, BuildCacheInvalidateBySourceInput, BuildCacheInvalidateBySourceOutput, BuildCacheInvalidateByKindInput, BuildCacheInvalidateByKindOutput, BuildCacheInvalidateAllInput, BuildCacheInvalidateAllOutput, BuildCacheStatusInput, BuildCacheStatusOutput, BuildCacheStaleStepsInput, BuildCacheStaleStepsOutput } from './types.js';
import { recordOk, checkUnchanged, checkChanged, invalidateOk, invalidateNotFound, invalidateBySourceOk, invalidateByKindOk, invalidateAllOk, statusOk, staleStepsOk } from './types.js';

export interface BuildCacheError { readonly code: string; readonly message: string; }
export interface BuildCacheHandler {
  readonly record: (input: BuildCacheRecordInput, storage: BuildCacheStorage) => TE.TaskEither<BuildCacheError, BuildCacheRecordOutput>;
  readonly check: (input: BuildCacheCheckInput, storage: BuildCacheStorage) => TE.TaskEither<BuildCacheError, BuildCacheCheckOutput>;
  readonly invalidate: (input: BuildCacheInvalidateInput, storage: BuildCacheStorage) => TE.TaskEither<BuildCacheError, BuildCacheInvalidateOutput>;
  readonly invalidateBySource: (input: BuildCacheInvalidateBySourceInput, storage: BuildCacheStorage) => TE.TaskEither<BuildCacheError, BuildCacheInvalidateBySourceOutput>;
  readonly invalidateByKind: (input: BuildCacheInvalidateByKindInput, storage: BuildCacheStorage) => TE.TaskEither<BuildCacheError, BuildCacheInvalidateByKindOutput>;
  readonly invalidateAll: (input: BuildCacheInvalidateAllInput, storage: BuildCacheStorage) => TE.TaskEither<BuildCacheError, BuildCacheInvalidateAllOutput>;
  readonly status: (input: BuildCacheStatusInput, storage: BuildCacheStorage) => TE.TaskEither<BuildCacheError, BuildCacheStatusOutput>;
  readonly staleSteps: (input: BuildCacheStaleStepsInput, storage: BuildCacheStorage) => TE.TaskEither<BuildCacheError, BuildCacheStaleStepsOutput>;
}

const err = (error: unknown): BuildCacheError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const buildCacheHandler: BuildCacheHandler = {
  record: (input, storage) => pipe(TE.tryCatch(async () => {
    const now = new Date();
    const isOption = (v: unknown): v is O.Option<string> => v != null && typeof v === 'object' && '_tag' in (v as any);
    const outputRef = isOption(input.outputRef) ? (O.isSome(input.outputRef) ? input.outputRef.value : undefined) : (input.outputRef as unknown as string | undefined);
    const sourceLocator = isOption(input.sourceLocator) ? (O.isSome(input.sourceLocator) ? input.sourceLocator.value : undefined) : (input.sourceLocator as unknown as string | undefined);
    await storage.put('cache_entry', input.stepKey, {
      stepKey: input.stepKey, inputHash: input.inputHash,
      outputHash: input.outputHash, outputRef, sourceLocator,
      deterministic: input.deterministic, lastRun: now.toISOString(), stale: false,
    });
    return recordOk(input.stepKey);
  }, err)),
  check: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('cache_entry', input.stepKey);
    if (!record) return { variant: 'changed' as const, previousHash: input.inputHash } as any;
    const storedHash = String(record.inputHash ?? '');
    if (storedHash === input.inputHash && input.deterministic) {
      const outputRef = record.outputRef ? String(record.outputRef) : undefined;
      return { variant: 'unchanged' as const, lastRun: new Date(String(record.lastRun)), outputRef } as any;
    }
    return { variant: 'changed' as const, previousHash: storedHash } as any;
  }, err)),
  invalidate: (input, storage) => pipe(TE.tryCatch(async () => {
    const existing = await storage.get('cache_entry', input.stepKey);
    if (!existing) {
      if (!input.stepKey.includes(':')) return invalidateNotFound();
      return invalidateOk();
    }
    await storage.delete('cache_entry', input.stepKey);
    return invalidateOk();
  }, err)),
  invalidateBySource: (input, storage) => pipe(TE.tryCatch(async () => {
    const all = await storage.find('cache_entry');
    const invalidated: string[] = [];
    for (const e of all) {
      if (e.sourceLocator === input.sourceLocator) {
        invalidated.push(String(e.stepKey));
        await storage.delete('cache_entry', String(e.stepKey));
      }
    }
    return invalidateBySourceOk(invalidated);
  }, err)),
  invalidateByKind: (input, storage) => pipe(TE.tryCatch(async () => {
    const all = await storage.find('cache_entry');
    const invalidated: string[] = [];
    for (const e of all) {
      if (e.kindName === input.kindName) {
        invalidated.push(String(e.stepKey));
        await storage.delete('cache_entry', String(e.stepKey));
      }
    }
    return invalidateByKindOk(invalidated);
  }, err)),
  invalidateAll: (_input, storage) => pipe(TE.tryCatch(async () => {
    const all = await storage.find('cache_entry');
    const count = all.length;
    for (const e of all) {
      await storage.delete('cache_entry', String(e.stepKey));
    }
    return invalidateAllOk(count);
  }, err)),
  status: (_input, storage) => pipe(TE.tryCatch(async () => {
    const all = await storage.find('cache_entry');
    const entries = all.map(e => ({
      stepKey: String(e.stepKey),
      inputHash: String(e.inputHash ?? ''),
      lastRun: new Date(String(e.lastRun)),
      stale: e.stale === true,
    }));
    return statusOk(entries);
  }, err)),
  staleSteps: (_input, storage) => pipe(TE.tryCatch(async () => {
    const all = await storage.find('cache_entry');
    const steps = all.filter(e => e.stale === true).map(e => String(e.stepKey));
    return staleStepsOk(steps);
  }, err)),
};
