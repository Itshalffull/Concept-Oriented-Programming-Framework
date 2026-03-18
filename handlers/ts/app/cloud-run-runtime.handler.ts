// @migrated dsl-constructs 2026-03-18
// CloudRunRuntime Concept Implementation
// Manage Google Cloud Run service deployments. Owns service URLs, revision
// history, IAM bindings, traffic splitting, and concurrency settings.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const cloudRunRuntimeHandlerFunctional: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const projectId = input.projectId as string;
    const region = input.region as string;
    const cpu = input.cpu as number;
    const memory = input.memory as number;

    const validRegions = [
      'us-central1', 'us-east1', 'us-west1', 'europe-west1',
      'asia-east1', 'asia-northeast1',
    ];
    if (!validRegions.includes(region)) {
      let p = createProgram();
      return complete(p, 'regionUnavailable', { region }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    if (projectId.startsWith('billing-disabled-')) {
      let p = createProgram();
      return complete(p, 'billingDisabled', { projectId }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const serviceId = `cloudrun-${concept.toLowerCase()}-${Date.now()}`;
    const serviceName = `${concept.toLowerCase()}-svc`;
    const serviceUrl = `https://${serviceName}-${projectId}.${region}.run.app`;
    const endpoint = serviceUrl;

    let p = createProgram();
    p = put(p, 'service', serviceId, {
      serviceUrl,
      projectId,
      region,
      cpu,
      memory,
      maxConcurrency: 80,
      minInstances: 0,
      maxInstances: 100,
      currentRevision: `${serviceName}-00001`,
      previousRevision: null,
      revisionHistory: JSON.stringify([`${serviceName}-00001`]),
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { service: serviceId, serviceUrl, endpoint }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  deploy(input: Record<string, unknown>) {
    const service = input.service as string;
    const imageUri = input.imageUri as string;

    if (imageUri.includes('notfound') || imageUri.includes('missing')) {
      let p = createProgram();
      return complete(p, 'imageNotFound', { imageUri }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'service', service, 'record');
    p = branch(p, 'record',
      (b) => {
        // Revision history update resolved at runtime from bindings
        return complete(b, 'ok', { service, revision: '' });
      },
      (b) => complete(b, 'imageNotFound', { imageUri }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setTrafficWeight(input: Record<string, unknown>) {
    const service = input.service as string;
    const weight = input.weight as number;

    let p = createProgram();
    p = spGet(p, 'service', service, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'service', service, { trafficWeight: weight });
        return complete(b2, 'ok', { service });
      },
      (b) => complete(b, 'ok', { service }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  rollback(input: Record<string, unknown>) {
    const service = input.service as string;
    const targetRevision = input.targetRevision as string;

    let p = createProgram();
    p = spGet(p, 'service', service, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'service', service, {
          currentRevision: targetRevision,
          lastDeployedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { service, restoredRevision: targetRevision });
      },
      (b) => complete(b, 'ok', { service, restoredRevision: targetRevision }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  destroy(input: Record<string, unknown>) {
    const service = input.service as string;

    let p = createProgram();
    p = del(p, 'service', service);
    return complete(p, 'ok', { service }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const cloudRunRuntimeHandler = wrapFunctional(cloudRunRuntimeHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { cloudRunRuntimeHandlerFunctional };
