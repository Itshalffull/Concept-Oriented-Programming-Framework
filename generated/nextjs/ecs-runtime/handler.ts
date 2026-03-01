// EcsRuntime — ECS task definitions, service management, and container orchestration
// Manages AWS ECS services: provisioning with cluster/capacity validation,
// deploying images with health check tracking, connection draining, and teardown.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  EcsRuntimeStorage,
  EcsRuntimeProvisionInput,
  EcsRuntimeProvisionOutput,
  EcsRuntimeDeployInput,
  EcsRuntimeDeployOutput,
  EcsRuntimeSetTrafficWeightInput,
  EcsRuntimeSetTrafficWeightOutput,
  EcsRuntimeRollbackInput,
  EcsRuntimeRollbackOutput,
  EcsRuntimeDestroyInput,
  EcsRuntimeDestroyOutput,
} from './types.js';

import {
  provisionOk,
  provisionCapacityUnavailable,
  provisionClusterNotFound,
  deployOk,
  deployImageNotFound,
  deployHealthCheckFailed,
  setTrafficWeightOk,
  rollbackOk,
  destroyOk,
  destroyDrainTimeout,
} from './types.js';

export interface EcsRuntimeError {
  readonly code: string;
  readonly message: string;
}

export interface EcsRuntimeHandler {
  readonly provision: (
    input: EcsRuntimeProvisionInput,
    storage: EcsRuntimeStorage,
  ) => TE.TaskEither<EcsRuntimeError, EcsRuntimeProvisionOutput>;
  readonly deploy: (
    input: EcsRuntimeDeployInput,
    storage: EcsRuntimeStorage,
  ) => TE.TaskEither<EcsRuntimeError, EcsRuntimeDeployOutput>;
  readonly setTrafficWeight: (
    input: EcsRuntimeSetTrafficWeightInput,
    storage: EcsRuntimeStorage,
  ) => TE.TaskEither<EcsRuntimeError, EcsRuntimeSetTrafficWeightOutput>;
  readonly rollback: (
    input: EcsRuntimeRollbackInput,
    storage: EcsRuntimeStorage,
  ) => TE.TaskEither<EcsRuntimeError, EcsRuntimeRollbackOutput>;
  readonly destroy: (
    input: EcsRuntimeDestroyInput,
    storage: EcsRuntimeStorage,
  ) => TE.TaskEither<EcsRuntimeError, EcsRuntimeDestroyOutput>;
}

const toError = (error: unknown): EcsRuntimeError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

let taskDefSeq = 0;

// --- Implementation ---

export const ecsRuntimeHandler: EcsRuntimeHandler = {
  provision: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('clusters', input.cluster),
        toError,
      ),
      TE.chain((clusterRecord) =>
        pipe(
          O.fromNullable(clusterRecord),
          O.fold(
            // Cluster must be pre-registered
            () => TE.right<EcsRuntimeError, EcsRuntimeProvisionOutput>(
              provisionClusterNotFound(input.cluster),
            ),
            (cluster) => {
              // Verify the cluster has sufficient CPU/memory capacity
              const availCpu = Number((cluster as Record<string, unknown>).availableCpu ?? 0);
              const availMem = Number((cluster as Record<string, unknown>).availableMemory ?? 0);

              if (availCpu < input.cpu || availMem < input.memory) {
                return TE.right<EcsRuntimeError, EcsRuntimeProvisionOutput>(
                  provisionCapacityUnavailable(
                    input.cluster,
                    `Requested ${input.cpu} CPU / ${input.memory} MB; available ${availCpu} CPU / ${availMem} MB`,
                  ),
                );
              }

              const serviceName = `ecs-${input.concept}`;
              const serviceArn = `arn:aws:ecs:us-east-1:123456789:service/${input.cluster}/${serviceName}`;
              const endpoint = `http://${serviceName}.${input.cluster}.local`;

              return TE.tryCatch(
                async () => {
                  await storage.put('ecs-services', serviceName, {
                    service: serviceName,
                    serviceArn,
                    concept: input.concept,
                    cluster: input.cluster,
                    cpu: input.cpu,
                    memory: input.memory,
                    endpoint,
                    taskDefCount: 0,
                    weight: 100,
                    activeConnections: 0,
                    createdAt: new Date().toISOString(),
                  });
                  // Decrement available capacity
                  await storage.put('clusters', input.cluster, {
                    ...cluster,
                    availableCpu: availCpu - input.cpu,
                    availableMemory: availMem - input.memory,
                  });
                  return provisionOk(serviceName, serviceArn, endpoint);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  deploy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('ecs-services', input.service),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<EcsRuntimeError, EcsRuntimeDeployOutput>({
              code: 'SERVICE_NOT_FOUND',
              message: `ECS service ${input.service} does not exist`,
            }),
            (existing) => {
              // Validate image URI (must include a registry)
              if (!input.imageUri.includes('/')) {
                return TE.right<EcsRuntimeError, EcsRuntimeDeployOutput>(
                  deployImageNotFound(input.imageUri),
                );
              }

              const taskDefCount = Number((existing as Record<string, unknown>).taskDefCount ?? 0);
              const taskDefinition = `${input.service}-td-${++taskDefSeq}`;

              return TE.tryCatch(
                async () => {
                  await storage.put('task-definitions', `${input.service}:${taskDefinition}`, {
                    service: input.service,
                    taskDefinition,
                    imageUri: input.imageUri,
                    deployedAt: new Date().toISOString(),
                  });
                  await storage.put('ecs-services', input.service, {
                    ...existing,
                    taskDefCount: taskDefCount + 1,
                    activeTaskDefinition: taskDefinition,
                    activeImage: input.imageUri,
                  });
                  return deployOk(input.service, taskDefinition);
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
        () => storage.get('ecs-services', input.service),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<EcsRuntimeError, EcsRuntimeSetTrafficWeightOutput>({
              code: 'SERVICE_NOT_FOUND',
              message: `ECS service ${input.service} does not exist`,
            }),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const clampedWeight = Math.max(0, Math.min(100, input.weight));
                  await storage.put('ecs-services', input.service, {
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
        () => storage.get('task-definitions', `${input.service}:${input.targetTaskDefinition}`),
        toError,
      ),
      TE.chain((tdRecord) =>
        pipe(
          O.fromNullable(tdRecord),
          O.fold(
            () => TE.left<EcsRuntimeError, EcsRuntimeRollbackOutput>({
              code: 'TASK_DEF_NOT_FOUND',
              message: `Task definition ${input.targetTaskDefinition} not found for ${input.service}`,
            }),
            (tdData) =>
              TE.tryCatch(
                async () => {
                  const serviceRecord = await storage.get('ecs-services', input.service);
                  if (serviceRecord) {
                    await storage.put('ecs-services', input.service, {
                      ...serviceRecord,
                      activeTaskDefinition: input.targetTaskDefinition,
                      activeImage: (tdData as Record<string, unknown>).imageUri,
                    });
                  }
                  return rollbackOk(input.service);
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
        () => storage.get('ecs-services', input.service),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<EcsRuntimeError, EcsRuntimeDestroyOutput>({
              code: 'SERVICE_NOT_FOUND',
              message: `ECS service ${input.service} does not exist`,
            }),
            (existing) => {
              // Check for active connections that need draining
              const activeConnections = Number((existing as Record<string, unknown>).activeConnections ?? 0);
              if (activeConnections > 0) {
                return TE.right<EcsRuntimeError, EcsRuntimeDestroyOutput>(
                  destroyDrainTimeout(input.service, activeConnections),
                );
              }

              return TE.tryCatch(
                async () => {
                  // Return capacity to the cluster
                  const clusterName = String((existing as Record<string, unknown>).cluster ?? '');
                  const clusterRecord = await storage.get('clusters', clusterName);
                  if (clusterRecord) {
                    const cpu = Number((existing as Record<string, unknown>).cpu ?? 0);
                    const memory = Number((existing as Record<string, unknown>).memory ?? 0);
                    await storage.put('clusters', clusterName, {
                      ...clusterRecord,
                      availableCpu: Number((clusterRecord as Record<string, unknown>).availableCpu ?? 0) + cpu,
                      availableMemory: Number((clusterRecord as Record<string, unknown>).availableMemory ?? 0) + memory,
                    });
                  }
                  await storage.delete('ecs-services', input.service);
                  return destroyOk(input.service);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),
};
