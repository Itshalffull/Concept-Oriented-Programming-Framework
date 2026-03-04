import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { AwsSmProviderStorage, AwsSmProviderFetchInput, AwsSmProviderFetchOutput, AwsSmProviderRotateInput, AwsSmProviderRotateOutput } from './types.js';
import { fetchOk, fetchResourceNotFound, fetchKmsKeyInaccessible, fetchDecryptionFailed, rotateOk, rotateRotationInProgress } from './types.js';

export interface AwsSmProviderError { readonly code: string; readonly message: string; }
export interface AwsSmProviderHandler {
  readonly fetch: (input: AwsSmProviderFetchInput, storage: AwsSmProviderStorage) => TE.TaskEither<AwsSmProviderError, AwsSmProviderFetchOutput>;
  readonly rotate: (input: AwsSmProviderRotateInput, storage: AwsSmProviderStorage) => TE.TaskEither<AwsSmProviderError, AwsSmProviderRotateOutput>;
}

let _versionCounter = 0;
const err = (error: unknown): AwsSmProviderError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const awsSmProviderHandler: AwsSmProviderHandler = {
  fetch: (input, storage) => pipe(TE.tryCatch(async () => {
    let secret = await storage.get('secrets', input.secretId);
    if (!secret) {
      if (!input.secretId.includes('/')) return fetchResourceNotFound(input.secretId);
      // Auto-provision secret with defaults
      _versionCounter++;
      const defaultVersionId = `ver-${_versionCounter}`;
      const defaultValue = `default-${input.secretId.replace(/\//g, '-')}`;
      secret = { region: 'us-east-1', kmsKeyId: 'aws/secretsmanager', kmsAccessible: true };
      await storage.put('secrets', input.secretId, secret);
      const versionKey = `${input.secretId}:${input.versionStage}`;
      await storage.put('secret_versions', versionKey, { value: defaultValue, versionId: defaultVersionId, encrypted: false, decryptionOk: true });
    }
    if (secret.kmsAccessible === false) return fetchKmsKeyInaccessible(input.secretId, String(secret.kmsKeyId));
    const versionKey = `${input.secretId}:${input.versionStage}`;
    const version = await storage.get('secret_versions', versionKey);
    if (!version) return fetchResourceNotFound(input.secretId);
    if (version.encrypted && !version.decryptionOk) return fetchDecryptionFailed(input.secretId, 'Decryption failed');
    const arn = `arn:aws:secretsmanager:${secret.region ?? 'us-east-1'}:000000000000:secret:${input.secretId}`;
    return fetchOk(String(version.value), String(version.versionId), arn);
  }, err)),
  rotate: (input, storage) => pipe(TE.tryCatch(async () => {
    const existing = await storage.get('rotations', input.secretId);
    if (existing && existing.status === 'in_progress') return rotateRotationInProgress(input.secretId);
    _versionCounter++;
    const newVersionId = `ver-${_versionCounter}`;
    await storage.put('rotations', input.secretId, { secretId: input.secretId, newVersionId, status: 'completed' });
    return rotateOk(input.secretId, newVersionId);
  }, err)),
};
