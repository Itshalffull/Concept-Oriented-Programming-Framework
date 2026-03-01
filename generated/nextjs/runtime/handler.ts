// Runtime — Lifecycle management for concept runtime instances: provisioning,
// deployment, traffic shaping, rollback, teardown, and health monitoring.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  RuntimeStorage,
  RuntimeProvisionInput,
  RuntimeProvisionOutput,
  RuntimeDeployInput,
  RuntimeDeployOutput,
  RuntimeSetTrafficWeightInput,
  RuntimeSetTrafficWeightOutput,
  RuntimeRollbackInput,
  RuntimeRollbackOutput,
  RuntimeDestroyInput,
  RuntimeDestroyOutput,
  RuntimeHealthCheckInput,
  RuntimeHealthCheckOutput,
} from './types.js';

import {
  provisionOk,
  provisionAlreadyProvisioned,
  provisionProvisionFailed,
  deployOk,
  deployDeployFailed,
  setTrafficWeightOk,
  rollbackOk,
  rollbackNoHistory,
  rollbackRollbackFailed,
  destroyOk,
  destroyDestroyFailed,
  healthCheckOk,
  healthCheckUnreachable,
  healthCheckDegraded,
} from './types.js';

export interface RuntimeError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): RuntimeError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

export interface RuntimeHandler {
  readonly provision: (
    input: RuntimeProvisionInput,
    storage: RuntimeStorage,
  ) => TE.TaskEither<RuntimeError, RuntimeProvisionOutput>;
  readonly deploy: (
    input: RuntimeDeployInput,
    storage: RuntimeStorage,
  ) => TE.TaskEither<RuntimeError, RuntimeDeployOutput>;
  readonly setTrafficWeight: (
    input: RuntimeSetTrafficWeightInput,
    storage: RuntimeStorage,
  ) => TE.TaskEither<RuntimeError, RuntimeSetTrafficWeightOutput>;
  readonly rollback: (
    input: RuntimeRollbackInput,
    storage: RuntimeStorage,
  ) => TE.TaskEither<RuntimeError, RuntimeRollbackOutput>;
  readonly destroy: (
    input: RuntimeDestroyInput,
    storage: RuntimeStorage,
  ) => TE.TaskEither<RuntimeError, RuntimeDestroyOutput>;
  readonly healthCheck: (
    input: RuntimeHealthCheckInput,
    storage: RuntimeStorage,
  ) => TE.TaskEither<RuntimeError, RuntimeHealthCheckOutput>;
}

// --- Implementation ---

export const runtimeHandler: RuntimeHandler = {
  provision: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('runtime_instances', input.concept),
        mkError('STORAGE_READ'),
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              pipe(
                TE.tryCatch(
                  async () => {
                    const instanceId = `${input.runtimeType}-${input.concept}-${Date.now()}`;
                    const endpoint = `https://${input.runtimeType}.runtime.local/${input.concept}`;
                    await storage.put('runtime_instances', input.concept, {
                      instanceId,
                      concept: input.concept,
                      runtimeType: input.runtimeType,
                      config: input.config,
                      endpoint,
                      status: 'provisioned',
                      createdAt: new Date().toISOString(),
                    });
                    return provisionOk(instanceId, endpoint);
                  },
                  mkError('PROVISION_FAILED'),
                ),
              ),
            (found) =>
              TE.right(
                provisionAlreadyProvisioned(
                  String(found.instanceId),
                  String(found.endpoint),
                ),
              ),
          ),
        ),
      ),
    ),

  deploy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('runtime_instances', input.instance),
        mkError('STORAGE_READ'),
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.right(
                deployDeployFailed(input.instance, `Instance ${input.instance} not found`),
              ),
            (found) =>
              pipe(
                TE.tryCatch(
                  async () => {
                    const previousVersion = found.version ? String(found.version) : undefined;
                    await storage.put('runtime_instances', input.instance, {
                      ...found,
                      artifact: input.artifact,
                      version: input.version,
                      previousVersion,
                      status: 'deployed',
                      deployedAt: new Date().toISOString(),
                    });
                    return deployOk(input.instance, String(found.endpoint));
                  },
                  mkError('DEPLOY_FAILED'),
                ),
              ),
          ),
        ),
      ),
    ),

  setTrafficWeight: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('runtime_instances', input.instance),
        mkError('STORAGE_READ'),
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () => TE.left<RuntimeError>({ code: 'NOT_FOUND', message: `Instance ${input.instance} not found` }),
            (found) =>
              pipe(
                TE.tryCatch(
                  async () => {
                    const clampedWeight = Math.max(0, Math.min(100, input.weight));
                    await storage.put('runtime_instances', input.instance, {
                      ...found,
                      trafficWeight: clampedWeight,
                    });
                    return setTrafficWeightOk(input.instance, clampedWeight);
                  },
                  mkError('WEIGHT_UPDATE_FAILED'),
                ),
              ),
          ),
        ),
      ),
    ),

  rollback: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('runtime_instances', input.instance),
        mkError('STORAGE_READ'),
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.right(
                rollbackRollbackFailed(input.instance, `Instance ${input.instance} not found`),
              ),
            (found) =>
              pipe(
                O.fromNullable(found.previousVersion),
                O.fold(
                  () => TE.right(rollbackNoHistory(input.instance)),
                  (prevVersion) =>
                    pipe(
                      TE.tryCatch(
                        async () => {
                          await storage.put('runtime_instances', input.instance, {
                            ...found,
                            version: prevVersion,
                            previousVersion: found.version,
                            status: 'rolled_back',
                            rolledBackAt: new Date().toISOString(),
                          });
                          return rollbackOk(input.instance, String(prevVersion));
                        },
                        mkError('ROLLBACK_FAILED'),
                      ),
                    ),
                ),
              ),
          ),
        ),
      ),
    ),

  destroy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('runtime_instances', input.instance),
        mkError('STORAGE_READ'),
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.right(
                destroyDestroyFailed(input.instance, `Instance ${input.instance} not found`),
              ),
            () =>
              pipe(
                TE.tryCatch(
                  async () => {
                    await storage.delete('runtime_instances', input.instance);
                    return destroyOk(input.instance);
                  },
                  mkError('DESTROY_FAILED'),
                ),
              ),
          ),
        ),
      ),
    ),

  healthCheck: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('runtime_instances', input.instance),
        mkError('STORAGE_READ'),
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () => TE.right(healthCheckUnreachable(input.instance)),
            (found) => {
              const status = String(found.status ?? 'unknown');
              const startMs = Date.now();
              if (status === 'provisioned' || status === 'deployed') {
                const latencyMs = Date.now() - startMs;
                return latencyMs > 5000
                  ? TE.right(healthCheckDegraded(input.instance, latencyMs))
                  : TE.right(healthCheckOk(input.instance, latencyMs));
              }
              return TE.right(healthCheckDegraded(input.instance, -1));
            },
          ),
        ),
      ),
    ),
};
