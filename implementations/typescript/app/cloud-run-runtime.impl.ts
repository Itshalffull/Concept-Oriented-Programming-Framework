// CloudRunRuntime Concept Implementation
// Manage Google Cloud Run service deployments. Owns service URLs, revision
// history, IAM bindings, traffic splitting, and concurrency settings.
import type { ConceptHandler } from '@copf/kernel';

export const cloudRunRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
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
      return { variant: 'regionUnavailable', region };
    }

    if (projectId.startsWith('billing-disabled-')) {
      return { variant: 'billingDisabled', projectId };
    }

    const serviceId = `cloudrun-${concept.toLowerCase()}-${Date.now()}`;
    const serviceName = `${concept.toLowerCase()}-svc`;
    const serviceUrl = `https://${serviceName}-${projectId}.${region}.run.app`;
    const endpoint = serviceUrl;

    await storage.put('service', serviceId, {
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

    return {
      variant: 'ok',
      service: serviceId,
      serviceUrl,
      endpoint,
    };
  },

  async deploy(input, storage) {
    const service = input.service as string;
    const imageUri = input.imageUri as string;

    if (imageUri.includes('notfound') || imageUri.includes('missing')) {
      return { variant: 'imageNotFound', imageUri };
    }

    const record = await storage.get('service', service);
    if (!record) {
      return { variant: 'imageNotFound', imageUri };
    }

    const currentRevision = record.currentRevision as string;
    const revisionHistory: string[] = JSON.parse(record.revisionHistory as string);
    const revisionNumber = revisionHistory.length + 1;
    const newRevision = `${currentRevision.replace(/-\d+$/, '')}-${String(revisionNumber).padStart(5, '0')}`;

    revisionHistory.push(newRevision);

    await storage.put('service', service, {
      ...record,
      currentRevision: newRevision,
      previousRevision: currentRevision,
      revisionHistory: JSON.stringify(revisionHistory),
      lastDeployedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      service,
      revision: newRevision,
    };
  },

  async setTrafficWeight(input, storage) {
    const service = input.service as string;
    const weight = input.weight as number;

    const record = await storage.get('service', service);
    if (record) {
      await storage.put('service', service, {
        ...record,
        trafficWeight: weight,
      });
    }

    return { variant: 'ok', service };
  },

  async rollback(input, storage) {
    const service = input.service as string;
    const targetRevision = input.targetRevision as string;

    const record = await storage.get('service', service);
    if (record) {
      await storage.put('service', service, {
        ...record,
        currentRevision: targetRevision,
        previousRevision: record.currentRevision,
        lastDeployedAt: new Date().toISOString(),
      });
    }

    return {
      variant: 'ok',
      service,
      restoredRevision: targetRevision,
    };
  },

  async destroy(input, storage) {
    const service = input.service as string;

    await storage.delete('service', service);

    return { variant: 'ok', service };
  },
};
