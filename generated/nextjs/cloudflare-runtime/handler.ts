// CloudflareRuntime — Edge function deployment, KV binding config, and route management
// Manages Cloudflare Workers lifecycle: provisioning workers with route bindings,
// deploying script bundles with size validation, traffic shifting, and teardown.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  CloudflareRuntimeStorage,
  CloudflareRuntimeProvisionInput,
  CloudflareRuntimeProvisionOutput,
  CloudflareRuntimeDeployInput,
  CloudflareRuntimeDeployOutput,
  CloudflareRuntimeSetTrafficWeightInput,
  CloudflareRuntimeSetTrafficWeightOutput,
  CloudflareRuntimeRollbackInput,
  CloudflareRuntimeRollbackOutput,
  CloudflareRuntimeDestroyInput,
  CloudflareRuntimeDestroyOutput,
} from './types.js';

import {
  provisionOk,
  provisionRouteConflict,
  deployOk,
  deployScriptTooLarge,
  setTrafficWeightOk,
  rollbackOk,
  destroyOk,
} from './types.js';

export interface CloudflareRuntimeError {
  readonly code: string;
  readonly message: string;
}

export interface CloudflareRuntimeHandler {
  readonly provision: (
    input: CloudflareRuntimeProvisionInput,
    storage: CloudflareRuntimeStorage,
  ) => TE.TaskEither<CloudflareRuntimeError, CloudflareRuntimeProvisionOutput>;
  readonly deploy: (
    input: CloudflareRuntimeDeployInput,
    storage: CloudflareRuntimeStorage,
  ) => TE.TaskEither<CloudflareRuntimeError, CloudflareRuntimeDeployOutput>;
  readonly setTrafficWeight: (
    input: CloudflareRuntimeSetTrafficWeightInput,
    storage: CloudflareRuntimeStorage,
  ) => TE.TaskEither<CloudflareRuntimeError, CloudflareRuntimeSetTrafficWeightOutput>;
  readonly rollback: (
    input: CloudflareRuntimeRollbackInput,
    storage: CloudflareRuntimeStorage,
  ) => TE.TaskEither<CloudflareRuntimeError, CloudflareRuntimeRollbackOutput>;
  readonly destroy: (
    input: CloudflareRuntimeDestroyInput,
    storage: CloudflareRuntimeStorage,
  ) => TE.TaskEither<CloudflareRuntimeError, CloudflareRuntimeDestroyOutput>;
}

// Cloudflare Workers have a 1 MB compressed script size limit
const CF_SCRIPT_SIZE_LIMIT = 1_048_576;

const toError = (error: unknown): CloudflareRuntimeError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const cloudflareRuntimeHandler: CloudflareRuntimeHandler = {
  provision: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('routes', { accountId: input.accountId }),
        toError,
      ),
      TE.chain((existingRoutes) => {
        // Check each requested route against existing bindings for conflicts
        const conflicting = input.routes
          .map((route) => {
            const match = existingRoutes.find(
              (r) => (r as Record<string, unknown>).route === route,
            );
            return match
              ? { route, existingWorker: String((match as Record<string, unknown>).worker) }
              : null;
          })
          .find((c) => c !== null);

        if (conflicting) {
          return TE.right(provisionRouteConflict(conflicting.route, conflicting.existingWorker));
        }

        const workerName = `worker-${input.concept}-${input.accountId}`;
        const scriptName = `${input.concept}-script`;
        const endpoint = `https://${workerName}.workers.dev`;

        return TE.tryCatch(
          async () => {
            // Persist worker record
            await storage.put('workers', workerName, {
              worker: workerName,
              concept: input.concept,
              accountId: input.accountId,
              scriptName,
              endpoint,
              version: 0,
              weight: 100,
              createdAt: new Date().toISOString(),
            });
            // Bind each route to the worker
            for (const route of input.routes) {
              await storage.put('routes', `${input.accountId}:${route}`, {
                route,
                worker: workerName,
                accountId: input.accountId,
              });
            }
            return provisionOk(workerName, scriptName, endpoint);
          },
          toError,
        );
      }),
    ),

  deploy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('workers', input.worker),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<CloudflareRuntimeError, CloudflareRuntimeDeployOutput>({
              code: 'WORKER_NOT_FOUND',
              message: `Worker ${input.worker} does not exist`,
            }),
            (existing) => {
              const sizeBytes = new TextEncoder().encode(input.scriptContent).length;
              if (sizeBytes > CF_SCRIPT_SIZE_LIMIT) {
                return TE.right<CloudflareRuntimeError, CloudflareRuntimeDeployOutput>(
                  deployScriptTooLarge(input.worker, sizeBytes, CF_SCRIPT_SIZE_LIMIT),
                );
              }
              const currentVersion = Number((existing as Record<string, unknown>).version ?? 0);
              const newVersion = `v${currentVersion + 1}`;
              return TE.tryCatch(
                async () => {
                  // Snapshot previous version for rollback
                  await storage.put('versions', `${input.worker}:${newVersion}`, {
                    worker: input.worker,
                    version: newVersion,
                    sizeBytes,
                    deployedAt: new Date().toISOString(),
                  });
                  await storage.put('workers', input.worker, {
                    ...existing,
                    version: currentVersion + 1,
                    lastDeployedAt: new Date().toISOString(),
                  });
                  return deployOk(input.worker, newVersion);
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
        () => storage.get('workers', input.worker),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<CloudflareRuntimeError, CloudflareRuntimeSetTrafficWeightOutput>({
              code: 'WORKER_NOT_FOUND',
              message: `Worker ${input.worker} does not exist`,
            }),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const clampedWeight = Math.max(0, Math.min(100, input.weight));
                  await storage.put('workers', input.worker, {
                    ...existing,
                    weight: clampedWeight,
                  });
                  return setTrafficWeightOk(input.worker);
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
        () => storage.get('versions', `${input.worker}:${input.targetVersion}`),
        toError,
      ),
      TE.chain((versionRecord) =>
        pipe(
          O.fromNullable(versionRecord),
          O.fold(
            () => TE.left<CloudflareRuntimeError, CloudflareRuntimeRollbackOutput>({
              code: 'VERSION_NOT_FOUND',
              message: `Version ${input.targetVersion} not found for worker ${input.worker}`,
            }),
            () =>
              TE.tryCatch(
                async () => {
                  const workerRecord = await storage.get('workers', input.worker);
                  if (workerRecord) {
                    await storage.put('workers', input.worker, {
                      ...workerRecord,
                      rolledBackTo: input.targetVersion,
                      lastDeployedAt: new Date().toISOString(),
                    });
                  }
                  return rollbackOk(input.worker, input.targetVersion);
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
        () => storage.get('workers', input.worker),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<CloudflareRuntimeError, CloudflareRuntimeDestroyOutput>({
              code: 'WORKER_NOT_FOUND',
              message: `Worker ${input.worker} does not exist`,
            }),
            (existing) =>
              TE.tryCatch(
                async () => {
                  // Remove route bindings for this worker
                  const routes = await storage.find('routes', { worker: input.worker });
                  for (const route of routes) {
                    const routeKey = String((route as Record<string, unknown>).route ?? '');
                    const accountId = String((route as Record<string, unknown>).accountId ?? '');
                    await storage.delete('routes', `${accountId}:${routeKey}`);
                  }
                  await storage.delete('workers', input.worker);
                  return destroyOk(input.worker);
                },
                toError,
              ),
          ),
        ),
      ),
    ),
};
