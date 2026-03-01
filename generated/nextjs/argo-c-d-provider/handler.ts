// ArgoCDProvider — ArgoCD GitOps provider: emits ArgoCD Application manifests,
// monitors reconciliation status with health/sync awareness, and configures
// sync waves for ordered resource deployment.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ArgoCDProviderStorage,
  ArgoCDProviderEmitInput,
  ArgoCDProviderEmitOutput,
  ArgoCDProviderReconciliationStatusInput,
  ArgoCDProviderReconciliationStatusOutput,
  ArgoCDProviderSyncWaveInput,
  ArgoCDProviderSyncWaveOutput,
} from './types.js';

import {
  emitOk,
  reconciliationStatusOk,
  reconciliationStatusPending,
  reconciliationStatusDegraded,
  reconciliationStatusFailed,
  syncWaveOk,
} from './types.js';

export interface ArgoCDProviderError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): ArgoCDProviderError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

export interface ArgoCDProviderHandler {
  readonly emit: (
    input: ArgoCDProviderEmitInput,
    storage: ArgoCDProviderStorage,
  ) => TE.TaskEither<ArgoCDProviderError, ArgoCDProviderEmitOutput>;
  readonly reconciliationStatus: (
    input: ArgoCDProviderReconciliationStatusInput,
    storage: ArgoCDProviderStorage,
  ) => TE.TaskEither<ArgoCDProviderError, ArgoCDProviderReconciliationStatusOutput>;
  readonly syncWave: (
    input: ArgoCDProviderSyncWaveInput,
    storage: ArgoCDProviderStorage,
  ) => TE.TaskEither<ArgoCDProviderError, ArgoCDProviderSyncWaveOutput>;
}

// --- Implementation ---

export const argoCDProviderHandler: ArgoCDProviderHandler = {
  emit: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const plan = JSON.parse(input.plan) as {
            readonly name?: string;
            readonly namespace?: string;
            readonly syncPolicy?: string;
          };
          const appName = plan.name ?? `app-${Date.now()}`;
          const namespace = plan.namespace ?? 'argocd';
          const applicationManifest = `${input.path}/application.yaml`;
          const kustomizationFile = `${input.path}/kustomization.yaml`;
          const files: readonly string[] = [applicationManifest, kustomizationFile];
          await storage.put('argocd_apps', appName, {
            application: appName,
            namespace,
            repo: input.repo,
            path: input.path,
            syncPolicy: plan.syncPolicy ?? 'automated',
            syncStatus: 'OutOfSync',
            healthStatus: 'Missing',
            waves: [],
            createdAt: new Date().toISOString(),
          });
          return emitOk(appName, files);
        },
        mkError('EMIT_FAILED'),
      ),
    ),

  reconciliationStatus: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('argocd_apps', input.application),
        mkError('STORAGE_READ'),
      ),
      TE.chain((appRecord) =>
        pipe(
          O.fromNullable(appRecord),
          O.fold(
            () =>
              TE.right(
                reconciliationStatusFailed(input.application, `Application '${input.application}' not found`),
              ),
            (found) => {
              const syncStatus = String(found.syncStatus ?? 'Unknown');
              const healthStatus = String(found.healthStatus ?? 'Unknown');
              const waitingOn = (found.waitingOn ?? []) as readonly string[];
              const unhealthyResources = (found.unhealthyResources ?? []) as readonly string[];

              if (waitingOn.length > 0) {
                return TE.right(
                  reconciliationStatusPending(input.application, waitingOn),
                );
              }
              if (unhealthyResources.length > 0) {
                return TE.right(
                  reconciliationStatusDegraded(input.application, unhealthyResources),
                );
              }
              if (syncStatus === 'Synced' && healthStatus === 'Healthy') {
                return TE.right(
                  reconciliationStatusOk(
                    input.application,
                    syncStatus,
                    healthStatus,
                    new Date(),
                  ),
                );
              }
              if (healthStatus === 'Degraded') {
                return TE.right(
                  reconciliationStatusDegraded(input.application, [healthStatus]),
                );
              }
              return TE.right(
                reconciliationStatusOk(
                  input.application,
                  syncStatus,
                  healthStatus,
                  new Date(),
                ),
              );
            },
          ),
        ),
      ),
    ),

  syncWave: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('argocd_apps', input.application),
        mkError('STORAGE_READ'),
      ),
      TE.chain((appRecord) =>
        pipe(
          O.fromNullable(appRecord),
          O.fold(
            () =>
              TE.left<ArgoCDProviderError>({
                code: 'APP_NOT_FOUND',
                message: `Application '${input.application}' not found`,
              }),
            (found) => {
              const existingWaves = (found.waves ?? []) as readonly number[];
              const updatedWaves = [...existingWaves, input.wave].sort(
                (a, b) => a - b,
              );
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('argocd_apps', input.application, {
                      ...found,
                      waves: updatedWaves,
                    });
                    return syncWaveOk(input.application);
                  },
                  mkError('SYNC_WAVE_FAILED'),
                ),
              );
            },
          ),
        ),
      ),
    ),
};
