// GcpSmProvider — Google Cloud Secret Manager integration.
// Fetches secrets by ID and version from GCP Secret Manager through a
// storage-backed abstraction. Handles IAM binding validation, version
// lifecycle (enabled/disabled), and secret rotation with new version IDs.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  GcpSmProviderStorage,
  GcpSmProviderFetchInput,
  GcpSmProviderFetchOutput,
  GcpSmProviderRotateInput,
  GcpSmProviderRotateOutput,
} from './types.js';

import {
  fetchOk,
  fetchIamBindingMissing,
  fetchVersionDisabled,
  fetchSecretNotFound,
  rotateOk,
} from './types.js';

export interface GcpSmProviderError {
  readonly code: string;
  readonly message: string;
}

export interface GcpSmProviderHandler {
  readonly fetch: (
    input: GcpSmProviderFetchInput,
    storage: GcpSmProviderStorage,
  ) => TE.TaskEither<GcpSmProviderError, GcpSmProviderFetchOutput>;
  readonly rotate: (
    input: GcpSmProviderRotateInput,
    storage: GcpSmProviderStorage,
  ) => TE.TaskEither<GcpSmProviderError, GcpSmProviderRotateOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): GcpSmProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Build the storage key for a secret version. */
const versionKey = (secretId: string, version: string): string =>
  `${secretId}:${version}`;

/** Generate a deterministic version ID for rotation. */
const generateVersionId = (secretId: string): string => {
  const timestamp = Date.now();
  return `v-${timestamp}-${secretId.slice(0, 8)}`;
};

// --- Implementation ---

export const gcpSmProviderHandler: GcpSmProviderHandler = {
  fetch: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { secretId, version } = input;

          // Resolve the version: "latest" fetches the most recent version record
          const resolvedVersion = version === 'latest' ? 'latest' : version;
          const key = versionKey(secretId, resolvedVersion);

          // Look up the secret in storage
          const secretRecord = await storage.get('secrets', secretId);

          return pipe(
            O.fromNullable(secretRecord),
            O.fold(
              () => {
                // Secret does not exist -- derive projectId from the secretId pattern
                const projectId = (secretId.split('/')[0]) ?? 'unknown-project';
                return fetchSecretNotFound(secretId, projectId);
              },
              async (record) => {
                const projectId = (record['projectId'] as string) ?? 'unknown-project';
                const iamBindings = (record['iamBindings'] as readonly string[]) ?? [];

                // Validate IAM bindings: the caller must have secretAccessor role
                if (iamBindings.length === 0) {
                  const principal = (record['requestingPrincipal'] as string) ?? 'unknown-principal';
                  return fetchIamBindingMissing(secretId, principal);
                }

                // Look up the specific version
                const versionRecord = await storage.get('secret_versions', key);

                return pipe(
                  O.fromNullable(versionRecord),
                  O.fold(
                    // Version not found -- treat as disabled (version may have been destroyed)
                    () => fetchVersionDisabled(secretId, resolvedVersion),
                    (ver) => {
                      const state = (ver['state'] as string) ?? 'ENABLED';

                      if (state === 'DISABLED' || state === 'DESTROYED') {
                        return fetchVersionDisabled(secretId, resolvedVersion);
                      }

                      const value = (ver['value'] as string) ?? '';
                      const versionId = (ver['versionId'] as string) ?? resolvedVersion;

                      return fetchOk(value, versionId, projectId);
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
          const newVersionId = generateVersionId(secretId);
          const key = versionKey(secretId, newVersionId);

          // Disable the current "latest" version
          const latestKey = versionKey(secretId, 'latest');
          const currentLatest = await storage.get('secret_versions', latestKey);

          if (currentLatest !== null) {
            await storage.put('secret_versions', latestKey, {
              ...currentLatest,
              state: 'DISABLED',
              disabledAt: new Date().toISOString(),
            });
          }

          // Create the new version record
          await storage.put('secret_versions', key, {
            secretId,
            versionId: newVersionId,
            state: 'ENABLED',
            value: '', // Value will be set by the caller after rotation
            createdAt: new Date().toISOString(),
          });

          // Update the "latest" pointer
          await storage.put('secret_versions', latestKey, {
            secretId,
            versionId: newVersionId,
            state: 'ENABLED',
            value: '',
            createdAt: new Date().toISOString(),
          });

          return rotateOk(secretId, newVersionId);
        },
        storageError,
      ),
    ),
};
