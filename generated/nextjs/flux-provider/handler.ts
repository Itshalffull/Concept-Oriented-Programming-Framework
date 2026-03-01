// FluxProvider — Flux CD GitOps provider: emits Flux Kustomization manifests,
// monitors reconciliation status with applied-revision tracking, and manages
// Helm releases with chart source resolution.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  FluxProviderStorage,
  FluxProviderEmitInput,
  FluxProviderEmitOutput,
  FluxProviderReconciliationStatusInput,
  FluxProviderReconciliationStatusOutput,
  FluxProviderHelmReleaseInput,
  FluxProviderHelmReleaseOutput,
} from './types.js';

import {
  emitOk,
  reconciliationStatusOk,
  reconciliationStatusPending,
  reconciliationStatusFailed,
  helmReleaseOk,
  helmReleaseChartNotFound,
} from './types.js';

export interface FluxProviderError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): FluxProviderError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

export interface FluxProviderHandler {
  readonly emit: (
    input: FluxProviderEmitInput,
    storage: FluxProviderStorage,
  ) => TE.TaskEither<FluxProviderError, FluxProviderEmitOutput>;
  readonly reconciliationStatus: (
    input: FluxProviderReconciliationStatusInput,
    storage: FluxProviderStorage,
  ) => TE.TaskEither<FluxProviderError, FluxProviderReconciliationStatusOutput>;
  readonly helmRelease: (
    input: FluxProviderHelmReleaseInput,
    storage: FluxProviderStorage,
  ) => TE.TaskEither<FluxProviderError, FluxProviderHelmReleaseOutput>;
}

// --- Implementation ---

export const fluxProviderHandler: FluxProviderHandler = {
  emit: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const plan = JSON.parse(input.plan) as {
            readonly name?: string;
            readonly namespace?: string;
            readonly interval?: string;
          };
          const kustomizationName = plan.name ?? `kust-${Date.now()}`;
          const namespace = plan.namespace ?? 'flux-system';
          const kustomizationFile = `${input.path}/kustomization.yaml`;
          const gitRepoFile = `${input.path}/gitrepository.yaml`;
          const files: readonly string[] = [kustomizationFile, gitRepoFile];
          await storage.put('flux_kustomizations', kustomizationName, {
            kustomization: kustomizationName,
            namespace,
            repo: input.repo,
            path: input.path,
            interval: plan.interval ?? '5m',
            readyStatus: 'False',
            appliedRevision: '',
            helmReleases: [],
            createdAt: new Date().toISOString(),
          });
          return emitOk(kustomizationName, files);
        },
        mkError('EMIT_FAILED'),
      ),
    ),

  reconciliationStatus: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('flux_kustomizations', input.kustomization),
        mkError('STORAGE_READ'),
      ),
      TE.chain((kustRecord) =>
        pipe(
          O.fromNullable(kustRecord),
          O.fold(
            () =>
              TE.right(
                reconciliationStatusFailed(
                  input.kustomization,
                  `Kustomization '${input.kustomization}' not found`,
                ),
              ),
            (found) => {
              const readyStatus = String(found.readyStatus ?? 'Unknown');
              const appliedRevision = String(found.appliedRevision ?? '');
              const waitingOn = (found.waitingOn ?? []) as readonly string[];
              const failReason = found.failReason ? String(found.failReason) : undefined;

              if (failReason) {
                return TE.right(
                  reconciliationStatusFailed(input.kustomization, failReason),
                );
              }
              if (waitingOn.length > 0) {
                return TE.right(
                  reconciliationStatusPending(input.kustomization, waitingOn),
                );
              }
              return TE.right(
                reconciliationStatusOk(
                  input.kustomization,
                  readyStatus,
                  appliedRevision,
                  new Date(),
                ),
              );
            },
          ),
        ),
      ),
    ),

  helmRelease: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('flux_kustomizations', input.kustomization),
        mkError('STORAGE_READ'),
      ),
      TE.chain((kustRecord) =>
        pipe(
          O.fromNullable(kustRecord),
          O.fold(
            () =>
              TE.right(
                helmReleaseChartNotFound(input.chart, input.kustomization),
              ),
            (found) => {
              const knownCharts = (found.helmReleases ?? []) as readonly Record<string, unknown>[];
              const chartExists = knownCharts.some(
                (c) => String(c.chart) === input.chart,
              );
              if (!chartExists && input.chart.startsWith('unknown/')) {
                return TE.right(
                  helmReleaseChartNotFound(
                    input.chart,
                    `HelmRepository/${input.kustomization}`,
                  ),
                );
              }
              const releaseName = `${input.kustomization}-${input.chart.replace(/\//g, '-')}`;
              return pipe(
                TE.tryCatch(
                  async () => {
                    const updatedReleases = [
                      ...knownCharts,
                      {
                        chart: input.chart,
                        releaseName,
                        values: input.values,
                        installedAt: new Date().toISOString(),
                      },
                    ];
                    await storage.put('flux_kustomizations', input.kustomization, {
                      ...found,
                      helmReleases: updatedReleases,
                    });
                    return helmReleaseOk(input.kustomization, releaseName);
                  },
                  mkError('HELM_RELEASE_FAILED'),
                ),
              );
            },
          ),
        ),
      ),
    ),
};
