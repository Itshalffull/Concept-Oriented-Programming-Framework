// DockerComposeRuntime Concept Implementation
// Manage Docker Compose service deployments for local and development
// environments. Owns service definitions, port mappings, and container lifecycle.
import type { ConceptHandler } from '@copf/kernel';

export const dockerComposeRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const composePath = input.composePath as string;
    const ports = input.ports as string[];

    // Check for port conflicts
    const existingServices = await storage.find('service');
    for (const existing of existingServices) {
      const existingPorts: string[] = JSON.parse(existing.ports as string);
      for (const port of ports) {
        if (existingPorts.includes(port)) {
          return {
            variant: 'portConflict',
            port: parseInt(port.split(':')[0], 10),
            existingService: existing.serviceName as string,
          };
        }
      }
    }

    const serviceId = `compose-svc-${concept.toLowerCase()}-${Date.now()}`;
    const serviceName = concept.toLowerCase();
    const hostPort = ports.length > 0 ? ports[0].split(':')[0] : '8080';
    const endpoint = `http://localhost:${hostPort}`;
    const containerId = `container-${Date.now().toString(36)}`;

    await storage.put('service', serviceId, {
      composePath,
      serviceName,
      image: `${concept.toLowerCase()}:latest`,
      ports: JSON.stringify(ports),
      environment: JSON.stringify([]),
      containerId,
      status: 'running',
      createdAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      service: serviceId,
      serviceName,
      endpoint,
    };
  },

  async deploy(input, storage) {
    const service = input.service as string;
    const imageUri = input.imageUri as string;

    const record = await storage.get('service', service);
    const containerId = `container-${Date.now().toString(36)}`;

    if (record) {
      await storage.put('service', service, {
        ...record,
        image: imageUri,
        containerId,
        status: 'running',
        lastDeployedAt: new Date().toISOString(),
      });
    }

    return {
      variant: 'ok',
      service,
      containerId,
    };
  },

  async setTrafficWeight(input, storage) {
    const service = input.service as string;
    // Traffic weight has no effect in Compose; always 100
    return { variant: 'ok', service };
  },

  async rollback(input, storage) {
    const service = input.service as string;
    const targetImage = input.targetImage as string;

    const record = await storage.get('service', service);
    if (record) {
      await storage.put('service', service, {
        ...record,
        image: targetImage,
        containerId: `container-${Date.now().toString(36)}`,
        lastDeployedAt: new Date().toISOString(),
      });
    }

    return {
      variant: 'ok',
      service,
      restoredImage: targetImage,
    };
  },

  async destroy(input, storage) {
    const service = input.service as string;

    const record = await storage.get('service', service);
    if (record) {
      await storage.put('service', service, {
        ...record,
        status: 'stopped',
        containerId: null,
      });
    }

    await storage.delete('service', service);

    return { variant: 'ok', service };
  },
};
