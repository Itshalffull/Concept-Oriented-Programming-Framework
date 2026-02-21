// PulumiProvider Concept Implementation
// Generate and apply Pulumi TypeScript programs from COPF deploy plans.
// Owns Pulumi stack state, backend configuration, and plugin versioning.
import type { ConceptHandler } from '@copf/kernel';

export const pulumiProviderHandler: ConceptHandler = {
  async generate(input, storage) {
    const plan = input.plan as string;

    const stackId = `pulumi-stack-${plan}-${Date.now()}`;
    const files = [
      `pulumi/${plan}/index.ts`,
      `pulumi/${plan}/compute.ts`,
      `pulumi/${plan}/storage.ts`,
      `pulumi/${plan}/transport.ts`,
      `pulumi/${plan}/Pulumi.yaml`,
    ];

    await storage.put('stack', stackId, {
      backend: 's3://pulumi-state',
      stackName: `stack-${plan}`,
      project: `project-${plan}`,
      plugins: JSON.stringify([
        { name: 'aws', version: '6.0.0' },
        { name: 'docker', version: '4.0.0' },
      ]),
      lastUpdatedAt: null,
      resourceCount: 0,
      pendingOperations: JSON.stringify([]),
      createdAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      stack: stackId,
      files,
    };
  },

  async preview(input, storage) {
    const stack = input.stack as string;

    const record = await storage.get('stack', stack);
    if (!record) {
      return {
        variant: 'backendUnreachable',
        backend: 'unknown',
      };
    }

    const backend = record.backend as string;
    if (backend.includes('unreachable') || backend.includes('offline')) {
      return {
        variant: 'backendUnreachable',
        backend,
      };
    }

    return {
      variant: 'ok',
      stack,
      toCreate: 5,
      toUpdate: 2,
      toDelete: 0,
      estimatedCost: 45.50,
    };
  },

  async apply(input, storage) {
    const stack = input.stack as string;

    const record = await storage.get('stack', stack);
    if (!record) {
      return {
        variant: 'pluginMissing',
        plugin: 'unknown',
        version: 'unknown',
      };
    }

    const pendingOperations: string[] = JSON.parse(record.pendingOperations as string);
    if (pendingOperations.length > 0) {
      return {
        variant: 'conflictingUpdate',
        stack,
        pendingOps: pendingOperations,
      };
    }

    const created = ['aws:ec2/vpc:Vpc', 'aws:ec2/subnet:Subnet', 'aws:ecs/cluster:Cluster',
                     'aws:ecs/service:Service', 'aws:lb/targetGroup:TargetGroup'];
    const updated = ['aws:iam/role:Role', 'aws:iam/policy:Policy'];

    await storage.put('stack', stack, {
      ...record,
      lastUpdatedAt: new Date().toISOString(),
      resourceCount: created.length + updated.length,
    });

    return {
      variant: 'ok',
      stack,
      created,
      updated,
    };
  },

  async teardown(input, storage) {
    const stack = input.stack as string;

    const record = await storage.get('stack', stack);
    if (!record) {
      return {
        variant: 'protectedResource',
        stack,
        resource: 'unknown',
      };
    }

    // Check for protected resources
    if (record.hasProtectedResources) {
      return {
        variant: 'protectedResource',
        stack,
        resource: record.protectedResource as string,
      };
    }

    const destroyed = ['aws:ec2/vpc:Vpc', 'aws:ec2/subnet:Subnet', 'aws:ecs/cluster:Cluster',
                       'aws:ecs/service:Service', 'aws:lb/targetGroup:TargetGroup',
                       'aws:iam/role:Role', 'aws:iam/policy:Policy'];

    await storage.delete('stack', stack);

    return {
      variant: 'ok',
      stack,
      destroyed,
    };
  },
};
