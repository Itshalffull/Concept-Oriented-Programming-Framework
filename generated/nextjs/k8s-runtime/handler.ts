// K8sRuntime — Kubernetes runtime adapter for deploying concepts as pods,
// managing services, handling scaling, and tracking deployment status.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  K8sRuntimeStorage,
  K8sRuntimeProvisionInput,
  K8sRuntimeProvisionOutput,
  K8sRuntimeDeployInput,
  K8sRuntimeDeployOutput,
  K8sRuntimeSetTrafficWeightInput,
  K8sRuntimeSetTrafficWeightOutput,
  K8sRuntimeRollbackInput,
  K8sRuntimeRollbackOutput,
  K8sRuntimeDestroyInput,
  K8sRuntimeDestroyOutput,
} from './types.js';

import {
  provisionOk,
  provisionResourceQuotaExceeded,
  provisionNamespaceNotFound,
  deployOk,
  deployImageNotFound,
  setTrafficWeightOk,
  rollbackOk,
  destroyOk,
} from './types.js';

export interface K8sRuntimeError {
  readonly code: string;
  readonly message: string;
}

const toError = (error: unknown): K8sRuntimeError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Maximum replicas enforced per namespace for resource quota validation
const MAX_REPLICAS_PER_NAMESPACE = 50;

export interface K8sRuntimeHandler {
  readonly provision: (
    input: K8sRuntimeProvisionInput,
    storage: K8sRuntimeStorage,
  ) => TE.TaskEither<K8sRuntimeError, K8sRuntimeProvisionOutput>;
  readonly deploy: (
    input: K8sRuntimeDeployInput,
    storage: K8sRuntimeStorage,
  ) => TE.TaskEither<K8sRuntimeError, K8sRuntimeDeployOutput>;
  readonly setTrafficWeight: (
    input: K8sRuntimeSetTrafficWeightInput,
    storage: K8sRuntimeStorage,
  ) => TE.TaskEither<K8sRuntimeError, K8sRuntimeSetTrafficWeightOutput>;
  readonly rollback: (
    input: K8sRuntimeRollbackInput,
    storage: K8sRuntimeStorage,
  ) => TE.TaskEither<K8sRuntimeError, K8sRuntimeRollbackOutput>;
  readonly destroy: (
    input: K8sRuntimeDestroyInput,
    storage: K8sRuntimeStorage,
  ) => TE.TaskEither<K8sRuntimeError, K8sRuntimeDestroyOutput>;
}

// --- Implementation ---

export const k8sRuntimeHandler: K8sRuntimeHandler = {
  // Provision a new K8s deployment: verify namespace exists, check resource quotas,
  // then create the deployment record with a generated service name and endpoint.
  provision: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('namespaces', input.namespace),
        toError,
      ),
      TE.chain((nsRecord) =>
        pipe(
          O.fromNullable(nsRecord),
          O.fold(
            () => TE.right(provisionNamespaceNotFound(input.namespace) as K8sRuntimeProvisionOutput),
            () =>
              pipe(
                TE.tryCatch(
                  () => storage.find('deployments', { namespace: input.namespace }),
                  toError,
                ),
                TE.chain((existing) => {
                  const totalReplicas = existing.reduce(
                    (sum, d) => sum + (typeof d.replicas === 'number' ? d.replicas : 0),
                    0,
                  );
                  if (totalReplicas + input.replicas > MAX_REPLICAS_PER_NAMESPACE) {
                    return TE.right(
                      provisionResourceQuotaExceeded(
                        input.namespace,
                        'replicas',
                        String(input.replicas),
                        String(MAX_REPLICAS_PER_NAMESPACE - totalReplicas),
                      ) as K8sRuntimeProvisionOutput,
                    );
                  }
                  const deploymentId = `${input.namespace}-${input.concept}`;
                  const serviceName = `svc-${input.concept}`;
                  const endpoint = `http://${serviceName}.${input.namespace}.svc.cluster.local`;
                  return pipe(
                    TE.tryCatch(
                      async () => {
                        await storage.put('deployments', deploymentId, {
                          concept: input.concept,
                          namespace: input.namespace,
                          cluster: input.cluster,
                          replicas: input.replicas,
                          serviceName,
                          endpoint,
                          status: 'provisioned',
                          revisions: [],
                          trafficWeight: 100,
                          createdAt: Date.now(),
                        });
                      },
                      toError,
                    ),
                    TE.map(() => provisionOk(deploymentId, serviceName, endpoint) as K8sRuntimeProvisionOutput),
                  );
                }),
              ),
          ),
        ),
      ),
    ),

  // Deploy a new image to an existing K8s deployment: verify the deployment exists,
  // validate the image URI format, record a new revision, and update status.
  deploy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('deployments', input.deployment),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(deployImageNotFound(input.imageUri) as K8sRuntimeDeployOutput),
            (existing) => {
              // Validate image URI has a tag or digest
              const hasTag = input.imageUri.includes(':') || input.imageUri.includes('@');
              if (!hasTag) {
                return TE.right(deployImageNotFound(input.imageUri) as K8sRuntimeDeployOutput);
              }
              const previousRevisions = Array.isArray(existing.revisions) ? existing.revisions : [];
              const revisionNumber = previousRevisions.length + 1;
              const revision = `rev-${revisionNumber}`;
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('deployments', input.deployment, {
                      ...existing,
                      imageUri: input.imageUri,
                      currentRevision: revision,
                      revisions: [...previousRevisions, { revision, imageUri: input.imageUri, deployedAt: Date.now() }],
                      status: 'deployed',
                    });
                  },
                  toError,
                ),
                TE.map(() => deployOk(input.deployment, revision) as K8sRuntimeDeployOutput),
              );
            },
          ),
        ),
      ),
    ),

  // Adjust traffic weight for a deployment. The weight (0-100) controls the
  // percentage of traffic routed to this deployment for canary/blue-green patterns.
  setTrafficWeight: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('deployments', input.deployment),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<K8sRuntimeError>({ code: 'NOT_FOUND', message: `Deployment ${input.deployment} not found` }),
            (existing) => {
              const clampedWeight = Math.max(0, Math.min(100, input.weight));
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('deployments', input.deployment, {
                      ...existing,
                      trafficWeight: clampedWeight,
                    });
                  },
                  toError,
                ),
                TE.map(() => setTrafficWeightOk(input.deployment)),
              );
            },
          ),
        ),
      ),
    ),

  // Roll back a deployment to a previous revision. Looks up the target revision
  // in the revision history and restores that image configuration.
  rollback: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('deployments', input.deployment),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<K8sRuntimeError>({ code: 'NOT_FOUND', message: `Deployment ${input.deployment} not found` }),
            (existing) => {
              const revisions = Array.isArray(existing.revisions) ? existing.revisions : [];
              const targetRev = revisions.find(
                (r: Record<string, unknown>) => r.revision === input.targetRevision,
              );
              if (!targetRev) {
                return TE.left<K8sRuntimeError>({
                  code: 'REVISION_NOT_FOUND',
                  message: `Revision ${input.targetRevision} not found for deployment ${input.deployment}`,
                });
              }
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('deployments', input.deployment, {
                      ...existing,
                      imageUri: targetRev.imageUri,
                      currentRevision: input.targetRevision,
                      status: 'rolled-back',
                    });
                  },
                  toError,
                ),
                TE.map(() => rollbackOk(input.deployment, input.targetRevision)),
              );
            },
          ),
        ),
      ),
    ),

  // Destroy a deployment by removing it from storage. Verifies existence first
  // to ensure idempotent cleanup.
  destroy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('deployments', input.deployment),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(destroyOk(input.deployment)),
            () =>
              pipe(
                TE.tryCatch(
                  async () => {
                    await storage.delete('deployments', input.deployment);
                  },
                  toError,
                ),
                TE.map(() => destroyOk(input.deployment)),
              ),
          ),
        ),
      ),
    ),
};
