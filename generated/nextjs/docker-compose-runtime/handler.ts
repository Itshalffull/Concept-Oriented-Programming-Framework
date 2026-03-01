// DockerComposeRuntime — Compose file generation, service dependency management, and networking
// Manages Docker Compose service lifecycle: provisioning with port conflict checks,
// deploying container images, rolling back to previous images, and teardown.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DockerComposeRuntimeStorage,
  DockerComposeRuntimeProvisionInput,
  DockerComposeRuntimeProvisionOutput,
  DockerComposeRuntimeDeployInput,
  DockerComposeRuntimeDeployOutput,
  DockerComposeRuntimeSetTrafficWeightInput,
  DockerComposeRuntimeSetTrafficWeightOutput,
  DockerComposeRuntimeRollbackInput,
  DockerComposeRuntimeRollbackOutput,
  DockerComposeRuntimeDestroyInput,
  DockerComposeRuntimeDestroyOutput,
} from './types.js';

import {
  provisionOk,
  provisionPortConflict,
  deployOk,
  setTrafficWeightOk,
  rollbackOk,
  destroyOk,
} from './types.js';

export interface DockerComposeRuntimeError {
  readonly code: string;
  readonly message: string;
}

export interface DockerComposeRuntimeHandler {
  readonly provision: (
    input: DockerComposeRuntimeProvisionInput,
    storage: DockerComposeRuntimeStorage,
  ) => TE.TaskEither<DockerComposeRuntimeError, DockerComposeRuntimeProvisionOutput>;
  readonly deploy: (
    input: DockerComposeRuntimeDeployInput,
    storage: DockerComposeRuntimeStorage,
  ) => TE.TaskEither<DockerComposeRuntimeError, DockerComposeRuntimeDeployOutput>;
  readonly setTrafficWeight: (
    input: DockerComposeRuntimeSetTrafficWeightInput,
    storage: DockerComposeRuntimeStorage,
  ) => TE.TaskEither<DockerComposeRuntimeError, DockerComposeRuntimeSetTrafficWeightOutput>;
  readonly rollback: (
    input: DockerComposeRuntimeRollbackInput,
    storage: DockerComposeRuntimeStorage,
  ) => TE.TaskEither<DockerComposeRuntimeError, DockerComposeRuntimeRollbackOutput>;
  readonly destroy: (
    input: DockerComposeRuntimeDestroyInput,
    storage: DockerComposeRuntimeStorage,
  ) => TE.TaskEither<DockerComposeRuntimeError, DockerComposeRuntimeDestroyOutput>;
}

const toError = (error: unknown): DockerComposeRuntimeError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

let containerSeq = 0;
const allocContainerId = (): string => `ctr-${++containerSeq}-${Date.now().toString(36)}`;

// --- Implementation ---

export const dockerComposeRuntimeHandler: DockerComposeRuntimeHandler = {
  provision: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('compose-ports'),
        toError,
      ),
      TE.chain((existingPorts) => {
        // Parse host ports from port mappings (e.g., "8080:80" -> 8080)
        for (const portSpec of input.ports) {
          const hostPort = Number(portSpec.split(':')[0]);
          const conflict = existingPorts.find(
            (r) => Number((r as Record<string, unknown>).port) === hostPort,
          );
          if (conflict) {
            return TE.right<DockerComposeRuntimeError, DockerComposeRuntimeProvisionOutput>(
              provisionPortConflict(
                hostPort,
                String((conflict as Record<string, unknown>).service),
              ),
            );
          }
        }

        const serviceName = `compose-${input.concept}`;
        const firstPort = input.ports.length > 0 ? input.ports[0].split(':')[0] : '8080';
        const endpoint = `http://localhost:${firstPort}`;

        return TE.tryCatch(
          async () => {
            await storage.put('compose-services', serviceName, {
              service: serviceName,
              serviceName,
              concept: input.concept,
              composePath: input.composePath,
              ports: input.ports,
              endpoint,
              weight: 100,
              createdAt: new Date().toISOString(),
            });
            // Register each host port
            for (const portSpec of input.ports) {
              const hostPort = Number(portSpec.split(':')[0]);
              await storage.put('compose-ports', String(hostPort), {
                port: hostPort,
                service: serviceName,
              });
            }
            return provisionOk(serviceName, serviceName, endpoint);
          },
          toError,
        );
      }),
    ),

  deploy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('compose-services', input.service),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<DockerComposeRuntimeError, DockerComposeRuntimeDeployOutput>({
              code: 'SERVICE_NOT_FOUND',
              message: `Compose service ${input.service} does not exist`,
            }),
            (existing) => {
              const containerId = allocContainerId();
              return TE.tryCatch(
                async () => {
                  // Track the image for rollback
                  await storage.put('compose-images', `${input.service}:${containerId}`, {
                    service: input.service,
                    containerId,
                    imageUri: input.imageUri,
                    deployedAt: new Date().toISOString(),
                  });
                  await storage.put('compose-services', input.service, {
                    ...existing,
                    activeImage: input.imageUri,
                    activeContainerId: containerId,
                  });
                  return deployOk(input.service, containerId);
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
        () => storage.get('compose-services', input.service),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<DockerComposeRuntimeError, DockerComposeRuntimeSetTrafficWeightOutput>({
              code: 'SERVICE_NOT_FOUND',
              message: `Compose service ${input.service} does not exist`,
            }),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const clampedWeight = Math.max(0, Math.min(100, input.weight));
                  await storage.put('compose-services', input.service, {
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
        () => storage.get('compose-services', input.service),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<DockerComposeRuntimeError, DockerComposeRuntimeRollbackOutput>({
              code: 'SERVICE_NOT_FOUND',
              message: `Compose service ${input.service} does not exist`,
            }),
            (existing) => {
              const containerId = allocContainerId();
              return TE.tryCatch(
                async () => {
                  await storage.put('compose-images', `${input.service}:${containerId}`, {
                    service: input.service,
                    containerId,
                    imageUri: input.targetImage,
                    deployedAt: new Date().toISOString(),
                  });
                  await storage.put('compose-services', input.service, {
                    ...existing,
                    activeImage: input.targetImage,
                    activeContainerId: containerId,
                  });
                  return rollbackOk(input.service, input.targetImage);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  destroy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('compose-services', input.service),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<DockerComposeRuntimeError, DockerComposeRuntimeDestroyOutput>({
              code: 'SERVICE_NOT_FOUND',
              message: `Compose service ${input.service} does not exist`,
            }),
            (existing) =>
              TE.tryCatch(
                async () => {
                  // Free port bindings
                  const ports = (existing as Record<string, unknown>).ports as readonly string[] | undefined;
                  if (ports) {
                    for (const portSpec of ports) {
                      const hostPort = portSpec.split(':')[0];
                      await storage.delete('compose-ports', hostPort);
                    }
                  }
                  await storage.delete('compose-services', input.service);
                  return destroyOk(input.service);
                },
                toError,
              ),
          ),
        ),
      ),
    ),
};
