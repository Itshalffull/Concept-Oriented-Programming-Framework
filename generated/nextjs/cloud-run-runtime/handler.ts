// CloudRunRuntime — Container service deployment, auto-scaling config, and revision management
// Manages Google Cloud Run services: provisioning with region/billing validation,
// deploying container images with revision tracking, traffic splitting, and teardown.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  CloudRunRuntimeStorage,
  CloudRunRuntimeProvisionInput,
  CloudRunRuntimeProvisionOutput,
  CloudRunRuntimeDeployInput,
  CloudRunRuntimeDeployOutput,
  CloudRunRuntimeSetTrafficWeightInput,
  CloudRunRuntimeSetTrafficWeightOutput,
  CloudRunRuntimeRollbackInput,
  CloudRunRuntimeRollbackOutput,
  CloudRunRuntimeDestroyInput,
  CloudRunRuntimeDestroyOutput,
} from './types.js';

import {
  provisionOk,
  provisionBillingDisabled,
  provisionRegionUnavailable,
  deployOk,
  deployImageNotFound,
  setTrafficWeightOk,
  rollbackOk,
  destroyOk,
} from './types.js';

export interface CloudRunRuntimeError {
  readonly code: string;
  readonly message: string;
}

export interface CloudRunRuntimeHandler {
  readonly provision: (
    input: CloudRunRuntimeProvisionInput,
    storage: CloudRunRuntimeStorage,
  ) => TE.TaskEither<CloudRunRuntimeError, CloudRunRuntimeProvisionOutput>;
  readonly deploy: (
    input: CloudRunRuntimeDeployInput,
    storage: CloudRunRuntimeStorage,
  ) => TE.TaskEither<CloudRunRuntimeError, CloudRunRuntimeDeployOutput>;
  readonly setTrafficWeight: (
    input: CloudRunRuntimeSetTrafficWeightInput,
    storage: CloudRunRuntimeStorage,
  ) => TE.TaskEither<CloudRunRuntimeError, CloudRunRuntimeSetTrafficWeightOutput>;
  readonly rollback: (
    input: CloudRunRuntimeRollbackInput,
    storage: CloudRunRuntimeStorage,
  ) => TE.TaskEither<CloudRunRuntimeError, CloudRunRuntimeRollbackOutput>;
  readonly destroy: (
    input: CloudRunRuntimeDestroyInput,
    storage: CloudRunRuntimeStorage,
  ) => TE.TaskEither<CloudRunRuntimeError, CloudRunRuntimeDestroyOutput>;
}

const SUPPORTED_REGIONS: readonly string[] = [
  'us-central1', 'us-east1', 'us-west1', 'europe-west1', 'asia-east1',
  'asia-northeast1', 'europe-west4', 'us-east4', 'asia-southeast1',
];

const toError = (error: unknown): CloudRunRuntimeError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const cloudRunRuntimeHandler: CloudRunRuntimeHandler = {
  provision: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('billing', input.projectId),
        toError,
      ),
      TE.chain((billingRecord) => {
        // Verify billing is enabled for the GCP project
        if (billingRecord && (billingRecord as Record<string, unknown>).disabled === true) {
          return TE.right<CloudRunRuntimeError, CloudRunRuntimeProvisionOutput>(
            provisionBillingDisabled(input.projectId),
          );
        }

        // Verify the requested region is available
        if (!SUPPORTED_REGIONS.includes(input.region)) {
          return TE.right<CloudRunRuntimeError, CloudRunRuntimeProvisionOutput>(
            provisionRegionUnavailable(input.region),
          );
        }

        const serviceName = `svc-${input.concept}-${input.region}`;
        const serviceUrl = `https://${serviceName}-${input.projectId}.a.run.app`;

        return TE.tryCatch(
          async () => {
            await storage.put('services', serviceName, {
              service: serviceName,
              concept: input.concept,
              projectId: input.projectId,
              region: input.region,
              cpu: input.cpu,
              memory: input.memory,
              serviceUrl,
              revisionCount: 0,
              weight: 100,
              createdAt: new Date().toISOString(),
            });
            return provisionOk(serviceName, serviceUrl, serviceUrl);
          },
          toError,
        );
      }),
    ),

  deploy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('services', input.service),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<CloudRunRuntimeError, CloudRunRuntimeDeployOutput>({
              code: 'SERVICE_NOT_FOUND',
              message: `Service ${input.service} does not exist`,
            }),
            (existing) => {
              // Validate image URI has a registry path
              if (!input.imageUri.includes('/')) {
                return TE.right<CloudRunRuntimeError, CloudRunRuntimeDeployOutput>(
                  deployImageNotFound(input.imageUri),
                );
              }

              const revisionCount = Number((existing as Record<string, unknown>).revisionCount ?? 0);
              const revision = `${input.service}-rev-${revisionCount + 1}`;

              return TE.tryCatch(
                async () => {
                  await storage.put('revisions', `${input.service}:${revision}`, {
                    service: input.service,
                    revision,
                    imageUri: input.imageUri,
                    deployedAt: new Date().toISOString(),
                  });
                  await storage.put('services', input.service, {
                    ...existing,
                    revisionCount: revisionCount + 1,
                    activeRevision: revision,
                    activeImage: input.imageUri,
                  });
                  return deployOk(input.service, revision);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  setTrafficWeight: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('services', input.service),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<CloudRunRuntimeError, CloudRunRuntimeSetTrafficWeightOutput>({
              code: 'SERVICE_NOT_FOUND',
              message: `Service ${input.service} does not exist`,
            }),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const clampedWeight = Math.max(0, Math.min(100, input.weight));
                  await storage.put('services', input.service, {
                    ...existing,
                    weight: clampedWeight,
                  });
                  return setTrafficWeightOk(input.service);
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  rollback: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('revisions', `${input.service}:${input.targetRevision}`),
        toError,
      ),
      TE.chain((revisionRecord) =>
        pipe(
          O.fromNullable(revisionRecord),
          O.fold(
            () => TE.left<CloudRunRuntimeError, CloudRunRuntimeRollbackOutput>({
              code: 'REVISION_NOT_FOUND',
              message: `Revision ${input.targetRevision} not found for ${input.service}`,
            }),
            (revData) =>
              TE.tryCatch(
                async () => {
                  const serviceRecord = await storage.get('services', input.service);
                  if (serviceRecord) {
                    await storage.put('services', input.service, {
                      ...serviceRecord,
                      activeRevision: input.targetRevision,
                      activeImage: (revData as Record<string, unknown>).imageUri,
                    });
                  }
                  return rollbackOk(input.service, input.targetRevision);
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  destroy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('services', input.service),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<CloudRunRuntimeError, CloudRunRuntimeDestroyOutput>({
              code: 'SERVICE_NOT_FOUND',
              message: `Service ${input.service} does not exist`,
            }),
            () =>
              TE.tryCatch(
                async () => {
                  const revisions = await storage.find('revisions', { service: input.service });
                  for (const rev of revisions) {
                    const revKey = String((rev as Record<string, unknown>).revision ?? '');
                    await storage.delete('revisions', `${input.service}:${revKey}`);
                  }
                  await storage.delete('services', input.service);
                  return destroyOk(input.service);
                },
                toError,
              ),
          ),
        ),
      ),
    ),
};
