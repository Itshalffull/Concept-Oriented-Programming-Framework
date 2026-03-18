// @migrated dsl-constructs 2026-03-18
// DockerComposeRuntime Concept Implementation
// Manage Docker Compose service deployments for local and development
// environments. Owns service definitions, port mappings, and container lifecycle.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const dockerComposeRuntimeHandler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const composePath = input.composePath as string;
    const ports = input.ports as string[];

    // Note: port conflict check via find cannot be fully expressed in branch;
    // we preserve the logic structurally
    let p = createProgram();
    p = find(p, 'service', {}, 'existingServices');

    const serviceId = `compose-svc-${concept.toLowerCase()}-${Date.now()}`;
    const serviceName = concept.toLowerCase();
    const hostPort = ports.length > 0 ? ports[0].split(':')[0] : '8080';
    const endpoint = `http://localhost:${hostPort}`;
    const containerId = `container-${Date.now().toString(36)}`;

    p = put(p, 'service', serviceId, {
      composePath,
      serviceName,
      image: `${concept.toLowerCase()}:latest`,
      ports: JSON.stringify(ports),
      environment: JSON.stringify([]),
      containerId,
      status: 'running',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', {
      service: serviceId,
      serviceName,
      endpoint,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  deploy(input: Record<string, unknown>) {
    const service = input.service as string;
    const imageUri = input.imageUri as string;

    let p = createProgram();
    p = spGet(p, 'service', service, 'record');
    const containerId = `container-${Date.now().toString(36)}`;

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'service', service, {
          image: imageUri,
          containerId,
          status: 'running',
          lastDeployedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { service, containerId });
      },
      (b) => complete(b, 'ok', { service, containerId }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setTrafficWeight(input: Record<string, unknown>) {
    const service = input.service as string;
    // Traffic weight has no effect in Compose; always 100
    const p = createProgram();
    return complete(p, 'ok', { service }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  rollback(input: Record<string, unknown>) {
    const service = input.service as string;
    const targetImage = input.targetImage as string;

    let p = createProgram();
    p = spGet(p, 'service', service, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'service', service, {
          image: targetImage,
          containerId: `container-${Date.now().toString(36)}`,
          lastDeployedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { service, restoredImage: targetImage });
      },
      (b) => complete(b, 'ok', { service, restoredImage: targetImage }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  destroy(input: Record<string, unknown>) {
    const service = input.service as string;

    let p = createProgram();
    p = spGet(p, 'service', service, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'service', service, {
          status: 'stopped',
          containerId: null,
        });
        b2 = del(b2, 'service', service);
        return complete(b2, 'ok', { service });
      },
      (b) => {
        let b2 = del(b, 'service', service);
        return complete(b2, 'ok', { service });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
