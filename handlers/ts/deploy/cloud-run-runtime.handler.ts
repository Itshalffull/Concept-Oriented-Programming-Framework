// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// CloudRunRuntime Concept Implementation
// Google Cloud Run provider for the Runtime coordination concept. Manages
// service provisioning, deployment, traffic splitting, and teardown.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'cloudrun';

const _cloudRunRuntimeHandler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const projectId = input.projectId as string;
    const region = input.region as string;
    const cpu = input.cpu as number;
    const memory = input.memory as number;

    const serviceId = `svc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const serviceUrl = `https://${concept}-${serviceId}.${region}.run.app`;
    const endpoint = serviceUrl;

    let p = createProgram();
    p = put(p, RELATION, serviceId, {
      service: serviceId,
      concept,
      projectId,
      region,
      cpu,
      memory,
      minInstances: 0,
      maxInstances: 100,
      serviceUrl,
      endpoint,
      currentRevision: '',
      status: 'provisioned',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { service: serviceId, serviceUrl, endpoint }) as StorageProgram<Result>;
  },

  deploy(input: Record<string, unknown>) {
    const service = input.service as string;
    const imageUri = input.imageUri as string;

    let p = createProgram();
    p = get(p, RELATION, service, 'record');

    return branch(p, 'record',
      (thenP) => {
        const revision = `rev-${Date.now()}`;
        thenP = putFrom(thenP, RELATION, service, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            currentRevision: revision,
            imageUri,
            status: 'deployed',
            deployedAt: new Date().toISOString(),
          };
        });
        return complete(thenP, 'ok', { service, revision });
      },
      (elseP) => complete(elseP, 'imageNotFound', { imageUri }),
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
    const targetRevision = input.targetRevision as string;

    let p = createProgram();
    p = get(p, RELATION, service, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, RELATION, service, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            currentRevision: targetRevision,
            status: 'rolledback',
          };
        });
        return complete(thenP, 'ok', { service, restoredRevision: targetRevision });
      },
      (elseP) => complete(elseP, 'ok', { service, restoredRevision: targetRevision }),
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

export const cloudRunRuntimeHandler = autoInterpret(_cloudRunRuntimeHandler);
