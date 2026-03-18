// @migrated dsl-constructs 2026-03-18
// DockerComposeRuntime Concept Implementation
// Docker Compose provider for the Runtime coordination concept. Manages
// service provisioning, container deployment, and lifecycle.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'dockercompose';

const _dockerComposeRuntimeHandler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const composePath = input.composePath as string;
    const ports = input.ports as string[];

    const serviceId = `dc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const serviceName = `${concept}-service`;
    const endpoint = `http://localhost:${ports[0]?.split(':')[0] || '8080'}`;

    let p = createProgram();
    p = put(p, RELATION, serviceId, {
      service: serviceId,
      concept,
      composePath,
      serviceName,
      ports: JSON.stringify(ports),
      endpoint,
      containerId: '',
      status: 'provisioned',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { service: serviceId, serviceName, endpoint }) as StorageProgram<Result>;
  },

  deploy(input: Record<string, unknown>) {
    const service = input.service as string;
    const imageUri = input.imageUri as string;

    let p = createProgram();
    p = get(p, RELATION, service, 'record');

    return branch(p, 'record',
      (thenP) => {
        const containerId = `ctr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        thenP = putFrom(thenP, RELATION, service, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            containerId,
            imageUri,
            status: 'deployed',
            deployedAt: new Date().toISOString(),
          };
        });
        return complete(thenP, 'ok', { service, containerId });
      },
      (elseP) => complete(elseP, 'ok', { service, containerId: '' }),
    ) as StorageProgram<Result>;
  },

  setTrafficWeight(input: Record<string, unknown>) {
    const service = input.service as string;
    const weight = input.weight as number;

    let p = createProgram();
    p = get(p, RELATION, service, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, RELATION, service, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, trafficWeight: weight };
        });
        return complete(thenP, 'ok', { service });
      },
      (elseP) => complete(elseP, 'ok', { service }),
    ) as StorageProgram<Result>;
  },

  rollback(input: Record<string, unknown>) {
    const service = input.service as string;
    const targetImage = input.targetImage as string;

    let p = createProgram();
    p = get(p, RELATION, service, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, RELATION, service, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            imageUri: targetImage,
            status: 'rolledback',
          };
        });
        return complete(thenP, 'ok', { service, restoredImage: targetImage });
      },
      (elseP) => complete(elseP, 'ok', { service, restoredImage: targetImage }),
    ) as StorageProgram<Result>;
  },

  destroy(input: Record<string, unknown>) {
    const service = input.service as string;

    let p = createProgram();
    p = get(p, RELATION, service, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = del(thenP, RELATION, service);
        return complete(thenP, 'ok', { service });
      },
      (elseP) => complete(elseP, 'ok', { service }),
    ) as StorageProgram<Result>;
  },
};

export const dockerComposeRuntimeHandler = autoInterpret(_dockerComposeRuntimeHandler);
