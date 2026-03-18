// @migrated dsl-constructs 2026-03-18
// EcsRuntime Concept Implementation
// AWS ECS Fargate provider for the Runtime coordination concept. Manages
// ECS service provisioning, task deployments, traffic shifting, and teardown.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'ecs';

const _ecsRuntimeHandler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const cpu = input.cpu as number;
    const memory = input.memory as number;
    const cluster = input.cluster as string;

    if (!cluster) {
      const p = createProgram();
      return complete(p, 'clusterNotFound', { cluster: '' }) as StorageProgram<Result>;
    }

    const serviceId = `svc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const serviceArn = `arn:aws:ecs:us-east-1:123456789:service/${cluster}/${concept}`;
    const endpoint = `https://${concept}.ecs.deploy.local`;

    let p = createProgram();
    p = put(p, RELATION, serviceId, {
      service: serviceId,
      concept,
      serviceArn,
      endpoint,
      cpu,
      memory,
      cluster,
      currentTaskDef: '',
      trafficWeight: 100,
      desiredCount: 1,
      runningCount: 0,
      status: 'provisioned',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { service: serviceId, serviceArn, endpoint }) as StorageProgram<Result>;
  },

  deploy(input: Record<string, unknown>) {
    const service = input.service as string;
    const imageUri = input.imageUri as string;

    let p = createProgram();
    p = get(p, RELATION, service, 'record');

    return branch(p, 'record',
      (thenP) => {
        const taskDefinition = `td-${Date.now()}`;
        thenP = putFrom(thenP, RELATION, service, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            currentTaskDef: taskDefinition,
            imageUri,
            status: 'deployed',
            runningCount: record.desiredCount as number,
            deployedAt: new Date().toISOString(),
          };
        });
        return complete(thenP, 'ok', { service, taskDefinition });
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
    const targetTaskDefinition = input.targetTaskDefinition as string;

    let p = createProgram();
    p = get(p, RELATION, service, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, RELATION, service, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            currentTaskDef: targetTaskDefinition,
            status: 'rolledback',
          };
        });
        return complete(thenP, 'ok', { service });
      },
      (elseP) => complete(elseP, 'ok', { service }),
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

export const ecsRuntimeHandler = autoInterpret(_ecsRuntimeHandler);
