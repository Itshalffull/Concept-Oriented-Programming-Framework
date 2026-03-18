// @migrated dsl-constructs 2026-03-18
// K8sRuntime Concept Implementation
// Kubernetes provider for the Runtime coordination concept. Manages
// Deployment, Service, ConfigMap, and Ingress resource lifecycle.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'k8s';

const _handler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const namespace = input.namespace as string;
    const cluster = input.cluster as string;
    const replicas = input.replicas as number;

    const deploymentId = `dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const serviceName = `${concept}-svc`;
    const endpoint = `http://${serviceName}.${namespace}.svc.cluster.local`;

    let p = createProgram();
    p = put(p, RELATION, deploymentId, {
      deployment: deploymentId,
      concept,
      namespace,
      cluster,
      replicas,
      serviceName,
      endpoint,
      currentRevision: '',
      image: '',
      status: 'provisioned',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { deployment: deploymentId, serviceName, endpoint }) as StorageProgram<Result>;
  },

  deploy(input: Record<string, unknown>) {
    const deployment = input.deployment as string;
    const imageUri = input.imageUri as string;

    let p = createProgram();
    p = get(p, RELATION, deployment, 'record');

    p = branch(p,
      (bindings) => !bindings.record,
      (b) => complete(b, 'imageNotFound', { imageUri }),
      (b) => {
        // Simulate imagePullBackOff for private registries without auth
        if (input.simulatePullBackOff) {
          return complete(b, 'imagePullBackOff', {
            deployment,
            imageUri,
            reason: 'unauthorized: authentication required',
          });
        }

        // Simulate OOM kill when memory limit is exceeded
        if (input.simulateOomKill) {
          let b2 = mapBindings(b, (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            return (record.memory as string) || '512Mi';
          }, 'memLimit');
          return completeFrom(b2, 'oomKilled', (bindings) => ({
            deployment,
            podName: `${deployment}-pod-${Math.random().toString(36).slice(2, 8)}`,
            memoryLimit: bindings.memLimit as string,
          }));
        }

        let b2 = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const prevRevision = record.currentRevision as string || '0';
          const revNum = prevRevision ? parseInt(prevRevision, 10) || 0 : 0;
          return String(revNum + 1);
        }, 'revision');

        b2 = putFrom(b2, RELATION, deployment, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            currentRevision: bindings.revision as string,
            image: imageUri,
            status: 'deployed',
            deployedAt: new Date().toISOString(),
          };
        });

        return completeFrom(b2, 'ok', (bindings) => ({
          deployment,
          revision: bindings.revision as string,
        }));
      },
    );

    return p as StorageProgram<Result>;
  },

  setTrafficWeight(input: Record<string, unknown>) {
    const deployment = input.deployment as string;
    const weight = input.weight as number;

    let p = createProgram();
    p = get(p, RELATION, deployment, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = putFrom(b, RELATION, deployment, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, trafficWeight: weight };
        });
        return complete(b2, 'ok', { deployment });
      },
      (b) => complete(b, 'ok', { deployment }),
    );

    return p as StorageProgram<Result>;
  },

  rollback(input: Record<string, unknown>) {
    const deployment = input.deployment as string;
    const targetRevision = input.targetRevision as string;

    let p = createProgram();
    p = get(p, RELATION, deployment, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = putFrom(b, RELATION, deployment, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            currentRevision: targetRevision,
            status: 'rolledback',
          };
        });
        return complete(b2, 'ok', { deployment, restoredRevision: targetRevision });
      },
      (b) => complete(b, 'ok', { deployment, restoredRevision: targetRevision }),
    );

    return p as StorageProgram<Result>;
  },

  destroy(input: Record<string, unknown>) {
    const deployment = input.deployment as string;

    let p = createProgram();
    p = get(p, RELATION, deployment, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = del(b, RELATION, deployment);
        return complete(b2, 'ok', { deployment });
      },
      (b) => complete(b, 'ok', { deployment }),
    );

    return p as StorageProgram<Result>;
  },
};

export const k8sRuntimeHandler = autoInterpret(_handler);
