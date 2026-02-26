// CloudRunRuntime Concept Implementation
// Google Cloud Run provider for the Runtime coordination concept. Manages
// service provisioning, deployment, traffic splitting, and teardown.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'cloudrun';

export const cloudRunRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const projectId = input.projectId as string;
    const region = input.region as string;
    const cpu = input.cpu as number;
    const memory = input.memory as number;

    const serviceId = `svc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const serviceUrl = `https://${concept}-${serviceId}.${region}.run.app`;
    const endpoint = serviceUrl;

    await storage.put(RELATION, serviceId, {
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

    return { variant: 'ok', service: serviceId, serviceUrl, endpoint };
  },

  async deploy(input, storage) {
    const service = input.service as string;
    const imageUri = input.imageUri as string;

    const record = await storage.get(RELATION, service);
    if (!record) {
      return { variant: 'imageNotFound', imageUri };
    }

    const revision = `rev-${Date.now()}`;

    await storage.put(RELATION, service, {
      ...record,
      currentRevision: revision,
      imageUri,
      status: 'deployed',
      deployedAt: new Date().toISOString(),
    });

    return { variant: 'ok', service, revision };
  },

  async setTrafficWeight(input, storage) {
    const service = input.service as string;
    const weight = input.weight as number;

    const record = await storage.get(RELATION, service);
    if (record) {
      await storage.put(RELATION, service, { ...record, trafficWeight: weight });
    }

    return { variant: 'ok', service };
  },

  async rollback(input, storage) {
    const service = input.service as string;
    const targetRevision = input.targetRevision as string;

    const record = await storage.get(RELATION, service);
    if (record) {
      await storage.put(RELATION, service, {
        ...record,
        currentRevision: targetRevision,
        status: 'rolledback',
      });
    }

    return { variant: 'ok', service, restoredRevision: targetRevision };
  },

  async destroy(input, storage) {
    const service = input.service as string;

    const record = await storage.get(RELATION, service);
    if (!record) {
      return { variant: 'ok', service };
    }

    await storage.del(RELATION, service);
    return { variant: 'ok', service };
  },
};
