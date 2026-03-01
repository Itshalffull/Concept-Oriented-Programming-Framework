// AwsSmProvider — AWS Secrets Manager integration.
// Fetches secrets by ID and version stage from AWS Secrets Manager through
// a storage-backed abstraction. Handles KMS key accessibility validation,
// resource existence checks, decryption verification, and rotation with
// in-progress detection to prevent concurrent rotation conflicts.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  AwsSmProviderStorage,
  AwsSmProviderFetchInput,
  AwsSmProviderFetchOutput,
  AwsSmProviderRotateInput,
  AwsSmProviderRotateOutput,
} from './types.js';

import {
  fetchOk,
  fetchKmsKeyInaccessible,
  fetchResourceNotFound,
  fetchDecryptionFailed,
  rotateOk,
  rotateRotationInProgress,
} from './types.js';

export interface AwsSmProviderError {
  readonly code: string;
  readonly message: string;
}

export interface AwsSmProviderHandler {
  readonly fetch: (
    input: AwsSmProviderFetchInput,
    storage: AwsSmProviderStorage,
  ) => TE.TaskEither<AwsSmProviderError, AwsSmProviderFetchOutput>;
  readonly rotate: (
    input: AwsSmProviderRotateInput,
    storage: AwsSmProviderStorage,
  ) => TE.TaskEither<AwsSmProviderError, AwsSmProviderRotateOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): AwsSmProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Build a storage key for a secret at a specific version stage. */
const stageKey = (secretId: string, versionStage: string): string =>
  `${secretId}:${versionStage}`;

/** Construct a synthetic ARN for storage-based secrets. */
const buildArn = (secretId: string, region: string): string =>
  `arn:aws:secretsmanager:${region}:000000000000:secret:${secretId}`;

/** Generate a unique version ID for a new rotation. */
const generateVersionId = (secretId: string): string => {
  const timestamp = Date.now();
  return `aws-${timestamp}-${secretId.slice(0, 8)}`;
};

// --- Implementation ---

export const awsSmProviderHandler: AwsSmProviderHandler = {
  fetch: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { secretId, versionStage } = input;

          // Look up the secret metadata
          const secretRecord = await storage.get('secrets', secretId);

          return pipe(
            O.fromNullable(secretRecord),
            O.fold(
              // Secret does not exist in storage
              () => fetchResourceNotFound(secretId),
              async (record) => {
                const region = (record['region'] as string) ?? 'us-east-1';
                const kmsKeyId = (record['kmsKeyId'] as string) ?? 'aws/secretsmanager';
                const kmsAccessible = (record['kmsAccessible'] as boolean) ?? true;

                // Validate KMS key accessibility
                if (!kmsAccessible) {
                  return fetchKmsKeyInaccessible(secretId, kmsKeyId);
                }

                // Fetch the specific version stage
                const key = stageKey(secretId, versionStage);
                const versionRecord = await storage.get('secret_versions', key);

                return pipe(
                  O.fromNullable(versionRecord),
                  O.fold(
                    // No version at this stage -- resource effectively not found
                    () => fetchResourceNotFound(secretId),
                    (ver) => {
                      const encrypted = (ver['encrypted'] as boolean) ?? false;
                      const decryptionOk = (ver['decryptionOk'] as boolean) ?? true;

                      // Simulate decryption failure
                      if (encrypted && !decryptionOk) {
                        return fetchDecryptionFailed(
                          secretId,
                          'Failed to decrypt secret value with the associated KMS key',
                        );
                      }

                      const value = (ver['value'] as string) ?? '';
                      const versionId = (ver['versionId'] as string) ?? 'AWSCURRENT';
                      const arn = buildArn(secretId, region);

                      return fetchOk(value, versionId, arn);
                    },
                  ),
                );
              },
            ),
          );
        },
        storageError,
      ),
    ),

  rotate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { secretId } = input;

          // Check if a rotation is already in progress
          const rotationRecord = await storage.get('rotations', secretId);

          const isRotating = pipe(
            O.fromNullable(rotationRecord),
            O.map((r) => (r['status'] as string) === 'in_progress'),
            O.getOrElse(() => false),
          );

          if (isRotating) {
            return rotateRotationInProgress(secretId);
          }

          const newVersionId = generateVersionId(secretId);

          // Mark rotation as in-progress
          await storage.put('rotations', secretId, {
            secretId,
            status: 'in_progress',
            newVersionId,
            startedAt: new Date().toISOString(),
          });

          // Create the new AWSPENDING version
          const pendingKey = stageKey(secretId, 'AWSPENDING');
          await storage.put('secret_versions', pendingKey, {
            secretId,
            versionId: newVersionId,
            value: '', // Value set by the rotation lambda
            encrypted: false,
            decryptionOk: true,
            createdAt: new Date().toISOString(),
          });

          // Promote AWSPENDING to AWSCURRENT
          const currentKey = stageKey(secretId, 'AWSCURRENT');
          await storage.put('secret_versions', currentKey, {
            secretId,
            versionId: newVersionId,
            value: '',
            encrypted: false,
            decryptionOk: true,
            promotedAt: new Date().toISOString(),
          });

          // Mark rotation as complete
          await storage.put('rotations', secretId, {
            secretId,
            status: 'completed',
            newVersionId,
            completedAt: new Date().toISOString(),
          });

          return rotateOk(secretId, newVersionId);
        },
        storageError,
      ),
    ),
};
