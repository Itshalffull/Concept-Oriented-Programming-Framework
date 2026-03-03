import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { AwsSmProviderStorage, AwsSmProviderFetchInput, AwsSmProviderFetchOutput, AwsSmProviderRotateInput, AwsSmProviderRotateOutput } from './types.js';
import { fetchOk, rotateOk } from './types.js';

export interface AwsSmProviderError { readonly code: string; readonly message: string; }
export interface AwsSmProviderHandler {
  readonly fetch: (input: AwsSmProviderFetchInput, storage: AwsSmProviderStorage) => TE.TaskEither<AwsSmProviderError, AwsSmProviderFetchOutput>;
  readonly rotate: (input: AwsSmProviderRotateInput, storage: AwsSmProviderStorage) => TE.TaskEither<AwsSmProviderError, AwsSmProviderRotateOutput>;
}

let _versionCounter = 0;
const err = (error: unknown): AwsSmProviderError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const awsSmProviderHandler: AwsSmProviderHandler = {
  fetch: (input, storage) => pipe(TE.tryCatch(async () => {
    _versionCounter++;
    const value = `secret-value-${_versionCounter}`;
    const versionId = `ver-${_versionCounter}`;
    const arn = `arn:aws:secretsmanager:us-east-1:000000000000:secret:${input.secretId}`;
    await storage.put('secrets', input.secretId, { secretId: input.secretId, value, versionId, arn, versionStage: input.versionStage });
    return fetchOk(value, versionId, arn);
  }, err)),
  rotate: (input, storage) => pipe(TE.tryCatch(async () => {
    _versionCounter++;
    const newVersionId = `ver-${_versionCounter}`;
    await storage.put('rotations', input.secretId, { secretId: input.secretId, newVersionId, status: 'completed' });
    return rotateOk(input.secretId, newVersionId);
  }, err)),
};
