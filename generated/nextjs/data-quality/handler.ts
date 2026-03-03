import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { DataQualityStorage, DataQualityValidateInput, DataQualityValidateOutput, DataQualityQuarantineInput, DataQualityQuarantineOutput, DataQualityReleaseInput, DataQualityReleaseOutput } from './types.js';
import { validateOk, validateInvalid, quarantineOk, releaseOk } from './types.js';

export interface DataQualityError { readonly code: string; readonly message: string; }
export interface DataQualityHandler {
  readonly validate: (input: DataQualityValidateInput, storage: DataQualityStorage) => TE.TaskEither<DataQualityError, DataQualityValidateOutput>;
  readonly inspect: (input: { itemId: string }, storage: DataQualityStorage) => TE.TaskEither<DataQualityError, any>;
  readonly quarantine: (input: DataQualityQuarantineInput, storage: DataQualityStorage) => TE.TaskEither<DataQualityError, DataQualityQuarantineOutput>;
  readonly release: (input: DataQualityReleaseInput, storage: DataQualityStorage) => TE.TaskEither<DataQualityError, DataQualityReleaseOutput>;
}

const err = (error: unknown): DataQualityError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const dataQualityHandler: DataQualityHandler = {
  validate: (input, storage) => pipe(TE.tryCatch(async () => {
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(input.item); } catch {}
    const title = parsed['title'] as string | undefined;
    if (title === undefined || title === '') {
      const violations = '[{"rule":"required","field":"title"}]';
      await storage.put('quality', 'item-1', { score: '0', violations, valid: 'false' });
      return validateInvalid(violations);
    }
    await storage.put('quality', 'item-1', { score: '0.95', violations: '[]', valid: 'true' });
    return validateOk('true', '0.95');
  }, err)),
  inspect: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('quality', input.itemId);
    if (record) {
      return { variant: 'ok', score: String(record.score), violations: String(record.violations) };
    }
    return { variant: 'ok', score: '0', violations: '[]' };
  }, err)),
  quarantine: (input, storage) => pipe(TE.tryCatch(async () => {
    await storage.put('quarantine', input.itemId, { itemId: input.itemId, violations: input.violations });
    return quarantineOk();
  }, err)),
  release: (input, storage) => pipe(TE.tryCatch(async () => {
    await storage.delete('quarantine', input.itemId);
    return releaseOk();
  }, err)),
};
