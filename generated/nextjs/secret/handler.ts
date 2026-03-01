// Secret — Secret/credential management
// Resolves secrets from named providers, checks existence, supports rotation
// with version tracking, and manages cache invalidation.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SecretStorage,
  SecretResolveInput,
  SecretResolveOutput,
  SecretExistsInput,
  SecretExistsOutput,
  SecretRotateInput,
  SecretRotateOutput,
  SecretInvalidateCacheInput,
  SecretInvalidateCacheOutput,
} from './types.js';

import {
  resolveOk,
  resolveNotFound,
  resolveAccessDenied,
  resolveExpired,
  existsOk,
  rotateOk,
  rotateRotationUnsupported,
  invalidateCacheOk,
} from './types.js';

export interface SecretError {
  readonly code: string;
  readonly message: string;
}

export interface SecretHandler {
  readonly resolve: (
    input: SecretResolveInput,
    storage: SecretStorage,
  ) => TE.TaskEither<SecretError, SecretResolveOutput>;
  readonly exists: (
    input: SecretExistsInput,
    storage: SecretStorage,
  ) => TE.TaskEither<SecretError, SecretExistsOutput>;
  readonly rotate: (
    input: SecretRotateInput,
    storage: SecretStorage,
  ) => TE.TaskEither<SecretError, SecretRotateOutput>;
  readonly invalidateCache: (
    input: SecretInvalidateCacheInput,
    storage: SecretStorage,
  ) => TE.TaskEither<SecretError, SecretInvalidateCacheOutput>;
}

const storageError = (error: unknown): SecretError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Build a composite key for provider-scoped secrets
const secretKey = (name: string, provider: string): string =>
  `${provider}::${name}`;

// Providers that support automatic rotation
const ROTATABLE_PROVIDERS: readonly string[] = ['aws-sm', 'gcp-sm', 'vault', 'azure-kv'];

// --- Implementation ---

export const secretHandler: SecretHandler = {
  // Resolve a secret by name from a specific provider.
  // Checks for access restrictions and expiry before returning the value.
  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('secrets', secretKey(input.name, input.provider)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(resolveNotFound(input.name, input.provider)),
            (found) => {
              const data = found as Record<string, unknown>;

              // Check access restrictions
              const restricted = data.restricted === true;
              if (restricted) {
                const reason = String(data.restrictionReason ?? 'Access denied by policy');
                return TE.right(resolveAccessDenied(input.name, input.provider, reason));
              }

              // Check expiry
              const expiresAtStr = data.expiresAt;
              if (typeof expiresAtStr === 'string' && expiresAtStr.length > 0) {
                const expiresAt = new Date(expiresAtStr);
                if (expiresAt.getTime() < Date.now()) {
                  return TE.right(resolveExpired(input.name, expiresAt));
                }
              }

              // Record access in audit log
              const secret = String(data.value ?? '');
              const version = String(data.version ?? '1');

              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('secret_access_log', `${input.name}::${now}`, {
                    name: input.name,
                    provider: input.provider,
                    accessedAt: now,
                    version,
                  });

                  // Update the cached copy timestamp
                  await storage.put('secret_cache', input.name, {
                    name: input.name,
                    provider: input.provider,
                    cachedAt: now,
                    version,
                  });

                  return resolveOk(secret, version);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  // Check whether a secret exists in a provider without retrieving its value.
  exists: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('secrets', secretKey(input.name, input.provider)),
        storageError,
      ),
      TE.map((record) =>
        existsOk(input.name, record !== null),
      ),
    ),

  // Rotate a secret to a new version. Only supported by certain providers.
  // Generates a new version identifier and updates the stored secret.
  rotate: (input, storage) => {
    if (!ROTATABLE_PROVIDERS.includes(input.provider)) {
      return TE.right(rotateRotationUnsupported(input.name, input.provider));
    }

    return pipe(
      TE.tryCatch(
        () => storage.get('secrets', secretKey(input.name, input.provider)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(rotateRotationUnsupported(input.name, input.provider)),
            (found) => {
              const data = found as Record<string, unknown>;
              const currentVersion = typeof data.version === 'string' ? data.version : '0';
              const versionNum = parseInt(currentVersion, 10);
              const newVersion = String(isNaN(versionNum) ? 1 : versionNum + 1);
              const now = new Date().toISOString();

              return TE.tryCatch(
                async () => {
                  // Store the updated secret with a new version
                  await storage.put('secrets', secretKey(input.name, input.provider), {
                    ...data,
                    version: newVersion,
                    rotatedAt: now,
                    updatedAt: now,
                  });

                  // Record the rotation event
                  await storage.put('secret_rotations', `${input.name}::${newVersion}`, {
                    name: input.name,
                    provider: input.provider,
                    previousVersion: currentVersion,
                    newVersion,
                    rotatedAt: now,
                  });

                  // Invalidate the cache for this secret
                  await storage.delete('secret_cache', input.name);

                  return rotateOk(input.name, newVersion);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    );
  },

  // Invalidate the cached copy of a secret, forcing a fresh resolve on next access.
  invalidateCache: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          await storage.delete('secret_cache', input.name);
          return invalidateCacheOk(input.name);
        },
        storageError,
      ),
    ),
};
