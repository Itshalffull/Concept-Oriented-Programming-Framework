// DockerComposeRuntime Concept Implementation
// Docker Compose provider for the Runtime coordination concept. Manages
// service provisioning, container deployment, and lifecycle.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'dockercompose';

export const dockerComposeRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const composePath = input.composePath as string;
    const ports = input.ports as string[];

    const serviceId = `dc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const serviceName = `${concept}-service`;
    const endpoint = `http://localhost:${ports[0]?.split(':')[0] || '8080'}`;

    await storage.put(RELATION, serviceId, {
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

    return { variant: 'ok', service: serviceId, serviceName, endpoint };
  },

  async deploy(input, storage) {
    const service = input.service as string;
    const imageUri = input.imageUri as string;

    const record = await storage.get(RELATION, service);
    if (!record) {
      return { variant: 'ok', service, containerId: '' };
    }

    const containerId = `ctr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await storage.put(RELATION, service, {
      ...record,
      containerId,
      imageUri,
      status: 'deployed',
      deployedAt: new Date().toISOString(),
    });

    return { variant: 'ok', service, containerId };
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
    const targetImage = input.targetImage as string;

    const record = await storage.get(RELATION, service);
    if (record) {
      await storage.put(RELATION, service, {
        ...record,
        imageUri: targetImage,
        status: 'rolledback',
      });
    }

    return { variant: 'ok', service, restoredImage: targetImage };
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
