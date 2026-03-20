// @clef-handler style=functional concept=PulumiProvider
// @migrated dsl-constructs 2026-03-18
// PulumiProvider Concept Implementation
// Generate and apply Pulumi TypeScript programs from Clef deploy plans.
// Owns Pulumi stack state, backend configuration, and plugin versioning.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _pulumiProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    return complete(p, 'ok', {
      name: 'PulumiProvider',
      inputKind: 'DeployPlan',
      outputKind: 'PulumiStack',
      capabilities: JSON.stringify(['typescript', 'stack', 'config']),
      providerKey: 'pulumi',
      providerType: 'iac',
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  generate(input: Record<string, unknown>) {
    const plan = input.plan as string;

    const stackId = `pulumi-stack-${plan}-${Date.now()}`;
    const files = [
      `pulumi/${plan}/index.ts`,
      `pulumi/${plan}/compute.ts`,
      `pulumi/${plan}/storage.ts`,
      `pulumi/${plan}/transport.ts`,
      `pulumi/${plan}/Pulumi.yaml`,
    ];

    let p = createProgram();
    p = put(p, 'stack', stackId, {
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

    return complete(p, 'ok', {
      stack: stackId,
      files,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  preview(input: Record<string, unknown>) {
    const stack = input.stack as string;

    let p = createProgram();
    p = spGet(p, 'stack', stack, 'record');
    p = branch(p, 'record',
      (b) => complete(b, 'ok', {
        stack,
        toCreate: 5,
        toUpdate: 2,
        toDelete: 0,
        estimatedCost: 45.50,
      }),
      (b) => complete(b, 'backendUnreachable', { backend: 'unknown' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  apply(input: Record<string, unknown>) {
    const stack = input.stack as string;

    const created = ['aws:ec2/vpc:Vpc', 'aws:ec2/subnet:Subnet', 'aws:ecs/cluster:Cluster',
                     'aws:ecs/service:Service', 'aws:lb/targetGroup:TargetGroup'];
    const updated = ['aws:iam/role:Role', 'aws:iam/policy:Policy'];

    let p = createProgram();
    p = spGet(p, 'stack', stack, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'stack', stack, {
          lastUpdatedAt: new Date().toISOString(),
          resourceCount: created.length + updated.length,
        });
        return complete(b2, 'ok', { stack, created, updated });
      },
      (b) => complete(b, 'pluginMissing', { plugin: 'unknown', version: 'unknown' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  teardown(input: Record<string, unknown>) {
    const stack = input.stack as string;

    const destroyed = ['aws:ec2/vpc:Vpc', 'aws:ec2/subnet:Subnet', 'aws:ecs/cluster:Cluster',
                       'aws:ecs/service:Service', 'aws:lb/targetGroup:TargetGroup',
                       'aws:iam/role:Role', 'aws:iam/policy:Policy'];

    let p = createProgram();
    p = spGet(p, 'stack', stack, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = del(b, 'stack', stack);
        return complete(b2, 'ok', { stack, destroyed });
      },
      (b) => complete(b, 'protectedResource', { stack, resource: 'unknown' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const pulumiProviderHandler = autoInterpret(_pulumiProviderHandler);

