// VaultProvider — HashiCorp Vault secret management: fetches secrets with
// seal/token awareness, manages lease lifecycles with renewal and expiration,
// and rotates secret versions at a given path.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  VaultProviderStorage,
  VaultProviderFetchInput,
  VaultProviderFetchOutput,
  VaultProviderRenewLeaseInput,
  VaultProviderRenewLeaseOutput,
  VaultProviderRotateInput,
  VaultProviderRotateOutput,
} from './types.js';

import {
  fetchOk,
  fetchSealed,
  fetchTokenExpired,
  fetchPathNotFound,
  renewLeaseOk,
  renewLeaseLeaseExpired,
  rotateOk,
} from './types.js';

export interface VaultProviderError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): VaultProviderError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

export interface VaultProviderHandler {
  readonly fetch: (
    input: VaultProviderFetchInput,
    storage: VaultProviderStorage,
  ) => TE.TaskEither<VaultProviderError, VaultProviderFetchOutput>;
  readonly renewLease: (
    input: VaultProviderRenewLeaseInput,
    storage: VaultProviderStorage,
  ) => TE.TaskEither<VaultProviderError, VaultProviderRenewLeaseOutput>;
  readonly rotate: (
    input: VaultProviderRotateInput,
    storage: VaultProviderStorage,
  ) => TE.TaskEither<VaultProviderError, VaultProviderRotateOutput>;
}

// --- Implementation ---

const DEFAULT_VAULT_ADDRESS = 'https://vault.local:8200';
const DEFAULT_LEASE_DURATION = 3600;

export const vaultProviderHandler: VaultProviderHandler = {
  fetch: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('vault_config', 'status'),
        mkError('STORAGE_READ'),
      ),
      TE.chain((vaultStatus) => {
        const status = vaultStatus
          ? String(vaultStatus.state ?? 'active')
          : 'active';
        const address = vaultStatus
          ? String(vaultStatus.address ?? DEFAULT_VAULT_ADDRESS)
          : DEFAULT_VAULT_ADDRESS;

        if (status === 'sealed') {
          return TE.right(fetchSealed(address));
        }
        if (status === 'token_expired') {
          return TE.right(fetchTokenExpired(address));
        }
        return pipe(
          TE.tryCatch(
            () => storage.get('vault_secrets', input.path),
            mkError('STORAGE_READ'),
          ),
          TE.chain((secretRecord) =>
            pipe(
              O.fromNullable(secretRecord),
              O.fold(
                () => TE.right(fetchPathNotFound(input.path)),
                (found) => {
                  const leaseId = `lease-${input.path.replace(/\//g, '-')}-${Date.now()}`;
                  const leaseDuration = Number(found.leaseDuration ?? DEFAULT_LEASE_DURATION);
                  return pipe(
                    TE.tryCatch(
                      async () => {
                        await storage.put('vault_leases', leaseId, {
                          leaseId,
                          path: input.path,
                          issuedAt: new Date().toISOString(),
                          expiresAt: new Date(
                            Date.now() + leaseDuration * 1000,
                          ).toISOString(),
                          duration: leaseDuration,
                        });
                        return fetchOk(
                          String(found.value),
                          leaseId,
                          leaseDuration,
                        );
                      },
                      mkError('LEASE_CREATE_FAILED'),
                    ),
                  );
                },
              ),
            ),
          ),
        );
      }),
    ),

  renewLease: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('vault_leases', input.leaseId),
        mkError('STORAGE_READ'),
      ),
      TE.chain((leaseRecord) =>
        pipe(
          O.fromNullable(leaseRecord),
          O.fold(
            () => TE.right(renewLeaseLeaseExpired(input.leaseId)),
            (found) => {
              const expiresAt = new Date(String(found.expiresAt));
              if (expiresAt.getTime() < Date.now()) {
                return pipe(
                  TE.tryCatch(
                    async () => {
                      await storage.delete('vault_leases', input.leaseId);
                      return renewLeaseLeaseExpired(input.leaseId);
                    },
                    mkError('LEASE_CLEANUP_FAILED'),
                  ),
                );
              }
              const originalDuration = Number(found.duration ?? DEFAULT_LEASE_DURATION);
              const newDuration = originalDuration;
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('vault_leases', input.leaseId, {
                      ...found,
                      expiresAt: new Date(
                        Date.now() + newDuration * 1000,
                      ).toISOString(),
                      renewedAt: new Date().toISOString(),
                    });
                    return renewLeaseOk(input.leaseId, newDuration);
                  },
                  mkError('LEASE_RENEW_FAILED'),
                ),
              );
            },
          ),
        ),
      ),
    ),

  rotate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('vault_secrets', input.path),
        mkError('STORAGE_READ'),
      ),
      TE.chain((secretRecord) =>
        pipe(
          O.fromNullable(secretRecord),
          O.fold(
            () =>
              pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('vault_secrets', input.path, {
                      path: input.path,
                      value: `rotated-${Date.now()}`,
                      version: 1,
                      leaseDuration: DEFAULT_LEASE_DURATION,
                      rotatedAt: new Date().toISOString(),
                    });
                    return rotateOk(1);
                  },
                  mkError('ROTATE_FAILED'),
                ),
              ),
            (found) => {
              const currentVersion = Number(found.version ?? 0);
              const newVersion = currentVersion + 1;
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('vault_secrets', input.path, {
                      ...found,
                      value: `rotated-${Date.now()}`,
                      version: newVersion,
                      rotatedAt: new Date().toISOString(),
                    });
                    return rotateOk(newVersion);
                  },
                  mkError('ROTATE_FAILED'),
                ),
              );
            },
          ),
        ),
      ),
    ),
};
