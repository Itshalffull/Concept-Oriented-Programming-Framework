// PulumiProvider Concept Implementation
// Pulumi IaC provider. Generates Pulumi programs from deploy plans,
// previews changes, applies stacks, and tears down resources.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'pulumi';

export const pulumiProviderHandler: ConceptHandler = {
  async generate(input, storage) {
    const plan = input.plan as string;

    const stackId = `stack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const files = ['index.ts', 'Pulumi.yaml', 'Pulumi.dev.yaml'];

    // Store concept state only — file output is routed through Emitter via syncs
    await storage.put(RELATION, stackId, {
      stack: stackId,
      plan,
      status: 'generated',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', stack: stackId, files };
  },

  async preview(input, storage) {
    const stack = input.stack as string;

    const record = await storage.get(RELATION, stack);
    if (!record) {
      return { variant: 'backendUnreachable', backend: 'local' };
    }

    return {
      variant: 'ok',
      stack,
      toCreate: 0,
      toUpdate: 0,
      toDelete: 0,
      estimatedCost: 0,
    };
  },

  async apply(input, storage) {
    const stack = input.stack as string;

    const record = await storage.get(RELATION, stack);
    if (!record) {
      return { variant: 'pluginMissing', plugin: 'unknown', version: '0.0.0' };
    }

    await storage.put(RELATION, stack, {
      ...record,
      status: 'applied',
      appliedAt: new Date().toISOString(),
    });

    return { variant: 'ok', stack, created: [], updated: [] };
  },

  async teardown(input, storage) {
    const stack = input.stack as string;

    const record = await storage.get(RELATION, stack);
    if (!record) {
      return { variant: 'ok', stack, destroyed: [] };
    }

    await storage.del(RELATION, stack);
    return { variant: 'ok', stack, destroyed: [stack] };
  },
};
