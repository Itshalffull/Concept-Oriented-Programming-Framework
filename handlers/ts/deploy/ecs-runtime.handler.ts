// EcsRuntime Concept Implementation
// AWS ECS Fargate provider for the Runtime coordination concept. Manages
// ECS service provisioning, task deployments, traffic shifting, and teardown.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'ecs';

export const ecsRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const cpu = input.cpu as number;
    const memory = input.memory as number;
    const cluster = input.cluster as string;

    if (!cluster) {
      return { variant: 'clusterNotFound', cluster: '' };
    }

    const serviceId = `svc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const serviceArn = `arn:aws:ecs:us-east-1:123456789:service/${cluster}/${concept}`;
    const endpoint = `https://${concept}.ecs.deploy.local`;

    await storage.put(RELATION, serviceId, {
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

    return { variant: 'ok', service: serviceId, serviceArn, endpoint };
  },

  async deploy(input, storage) {
    const service = input.service as string;
    const imageUri = input.imageUri as string;

    const record = await storage.get(RELATION, service);
    if (!record) {
      return { variant: 'imageNotFound', imageUri };
    }

    const taskDefinition = `td-${Date.now()}`;

    await storage.put(RELATION, service, {
      ...record,
      currentTaskDef: taskDefinition,
      imageUri,
      status: 'deployed',
      runningCount: record.desiredCount as number,
      deployedAt: new Date().toISOString(),
    });

    return { variant: 'ok', service, taskDefinition };
  },

  async setTrafficWeight(input, storage) {
    const service = input.service as string;
    const weight = input.weight as number;

    const record = await storage.get(RELATION, service);
    if (record) {
      await storage.put(RELATION, service, {
        ...record,
        trafficWeight: weight,
      });
    }

    return { variant: 'ok', service };
  },

  async rollback(input, storage) {
    const service = input.service as string;
    const targetTaskDefinition = input.targetTaskDefinition as string;

    const record = await storage.get(RELATION, service);
    if (record) {
      await storage.put(RELATION, service, {
        ...record,
        currentTaskDef: targetTaskDefinition,
        status: 'rolledback',
      });
    }

    return { variant: 'ok', service };
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
