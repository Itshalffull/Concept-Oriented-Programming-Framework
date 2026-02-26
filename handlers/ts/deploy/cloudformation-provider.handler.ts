// CloudFormationProvider Concept Implementation
// AWS CloudFormation IaC provider. Generates CloudFormation templates,
// manages change sets, applies stacks, and handles teardown.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'cfn';

export const cloudFormationProviderHandler: ConceptHandler = {
  async generate(input, storage) {
    const plan = input.plan as string;
    const requiredCapabilities = input.requiredCapabilities as string[] | undefined;

    const stackId = `stack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const files = ['template.yaml', 'parameters.json'];

    // Store concept state only — file output is routed through Emitter via syncs
    await storage.put(RELATION, stackId, {
      stack: stackId,
      plan,
      requiredCapabilities: requiredCapabilities ? JSON.stringify(requiredCapabilities) : '',
      status: 'generated',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', stack: stackId, files };
  },

  async preview(input, storage) {
    const stack = input.stack as string;

    const record = await storage.get(RELATION, stack);
    if (!record) {
      return { variant: 'changeSetEmpty', stack };
    }

    const changeSetId = `cs-${Date.now()}`;

    return {
      variant: 'ok',
      stack,
      changeSetId,
      toCreate: 0,
      toUpdate: 0,
      toDelete: 0,
    };
  },

  async apply(input, storage) {
    const stack = input.stack as string;
    const capabilities = input.capabilities as string[] | undefined;

    const record = await storage.get(RELATION, stack);
    if (!record) {
      return { variant: 'rollbackComplete', stack, reason: 'Stack not found' };
    }

    const requiredCapabilities = record.requiredCapabilities
      ? JSON.parse(record.requiredCapabilities as string) as string[]
      : [];
    if (requiredCapabilities.length > 0 && (!capabilities || !requiredCapabilities.every((c: string) => capabilities.includes(c)))) {
      return { variant: 'insufficientCapabilities', stack, required: requiredCapabilities };
    }

    const stackId = `arn:aws:cloudformation:us-east-1:123456789:stack/${stack}`;

    await storage.put(RELATION, stack, {
      ...record,
      stackId,
      status: 'applied',
      appliedAt: new Date().toISOString(),
    });

    return { variant: 'ok', stack, stackId, created: [], updated: [] };
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
