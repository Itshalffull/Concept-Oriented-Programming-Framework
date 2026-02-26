// EcsRuntime Concept Implementation
// Manage AWS ECS Fargate service deployments. Owns service configurations,
// task definitions, ALB target groups, auto-scaling policies, and service
// mesh settings.
import type { ConceptHandler } from '@clef/kernel';

export const ecsRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const cpu = input.cpu as number;
    const memory = input.memory as number;
    const cluster = input.cluster as string;

    if (cluster.includes('notfound') || cluster.includes('missing')) {
      return { variant: 'clusterNotFound', cluster };
    }

    if (cpu > 4096 || memory > 30720) {
      return {
        variant: 'capacityUnavailable',
        cluster,
        requested: `cpu=${cpu}, memory=${memory}`,
      };
    }

    const serviceId = `ecs-svc-${concept.toLowerCase()}-${Date.now()}`;
    const serviceName = `${concept.toLowerCase()}-svc`;
    const serviceArn = `arn:aws:ecs:us-east-1:123456789012:service/${cluster}/${serviceName}`;
    const clusterArn = `arn:aws:ecs:us-east-1:123456789012:cluster/${cluster}`;
    const taskDef = `${concept.toLowerCase()}-task:1`;
    const endpoint = `http://${serviceName}.${cluster}.internal`;

    await storage.put('service', serviceId, {
      serviceArn,
      clusterArn,
      taskDefinition: taskDef,
      desiredCount: 1,
      cpu,
      memory,
      targetGroupArn: null,
      minInstances: 1,
      maxInstances: 10,
      targetCpu: 70,
      createdAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      service: serviceId,
      serviceArn,
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

    const currentTaskDef = record.taskDefinition as string;
    const baseName = currentTaskDef.split(':')[0];
    const currentVersion = parseInt(currentTaskDef.split(':')[1], 10);
    const newTaskDef = `${baseName}:${currentVersion + 1}`;

    await storage.put('service', service, {
      ...record,
      taskDefinition: newTaskDef,
      lastDeployedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      service,
      taskDefinition: newTaskDef,
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
    const targetTaskDefinition = input.targetTaskDefinition as string;

    const record = await storage.get('service', service);
    if (record) {
      await storage.put('service', service, {
        ...record,
        taskDefinition: targetTaskDefinition,
        lastDeployedAt: new Date().toISOString(),
      });
    }

    return { variant: 'ok', service };
  },

  async destroy(input, storage) {
    const service = input.service as string;

    const record = await storage.get('service', service);
    if (record) {
      // Simulate drain timeout check
      const activeConnections = record.activeConnections as number | undefined;
      if (activeConnections && activeConnections > 0) {
        return {
          variant: 'drainTimeout',
          service,
          activeConnections,
        };
      }
    }

    await storage.delete('service', service);

    return { variant: 'ok', service };
  },
};
