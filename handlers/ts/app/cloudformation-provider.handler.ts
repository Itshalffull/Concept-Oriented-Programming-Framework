// CloudFormationProvider Concept Implementation
// Generate and apply AWS CloudFormation templates from Clef deploy plans.
// Owns stack IDs, change set management, rollback configurations, and
// stack event tracking.
import type { ConceptHandler } from '@clef/runtime';

export const cloudformationProviderHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'CloudFormationProvider',
      inputKind: 'DeployPlan',
      outputKind: 'CloudFormationTemplate',
      capabilities: JSON.stringify(['yaml', 'stack', 'parameters']),
      providerKey: 'cloudformation',
      providerType: 'iac',
    };
  },

  async generate(input, storage) {
    const plan = input.plan as string;

    const stackId = `cfn-stack-${plan}-${Date.now()}`;
    const files = [
      `cloudformation/${plan}/template.yaml`,
      `cloudformation/${plan}/parameters.json`,
    ];

    await storage.put('stack', stackId, {
      stackName: `stack-${plan}`,
      region: 'us-east-1',
      templateUrl: null,
      capabilities: JSON.stringify(['CAPABILITY_IAM']),
      stackId: null,
      changeSetId: null,
      lastEventAt: null,
      stackStatus: 'REVIEW_IN_PROGRESS',
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
      return { variant: 'changeSetEmpty', stack };
    }

    const stackStatus = record.stackStatus as string;
    if (stackStatus === 'CREATE_COMPLETE' || stackStatus === 'UPDATE_COMPLETE') {
      return { variant: 'changeSetEmpty', stack };
    }

    const changeSetId = `cs-${Date.now()}`;

    await storage.put('stack', stack, {
      ...record,
      changeSetId,
    });

    return {
      variant: 'ok',
      stack,
      changeSetId,
      toCreate: 3,
      toUpdate: 1,
      toDelete: 0,
    };
  },

  async apply(input, storage) {
    const stack = input.stack as string;

    const record = await storage.get('stack', stack);
    if (!record) {
      return {
        variant: 'rollbackComplete',
        stack,
        reason: 'Stack not found',
      };
    }

    const capabilities: string[] = JSON.parse(record.capabilities as string);
    const stackStatus = record.stackStatus as string;

    // Simulate insufficient capabilities check
    if (stackStatus === 'REQUIRES_CAPABILITIES') {
      return {
        variant: 'insufficientCapabilities',
        stack,
        required: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
      };
    }

    const awsStackId = `arn:aws:cloudformation:us-east-1:123456789012:stack/${record.stackName}/${Date.now()}`;
    const created = ['AWS::EC2::VPC', 'AWS::EC2::Subnet', 'AWS::ECS::Cluster'];
    const updated = ['AWS::IAM::Role'];

    await storage.put('stack', stack, {
      ...record,
      stackId: awsStackId,
      stackStatus: 'CREATE_COMPLETE',
      lastEventAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      stack,
      stackId: awsStackId,
      created,
      updated,
    };
  },

  async teardown(input, storage) {
    const stack = input.stack as string;

    const record = await storage.get('stack', stack);
    if (!record) {
      return {
        variant: 'deletionFailed',
        stack,
        resource: 'unknown',
        reason: 'Stack not found',
      };
    }

    const destroyed = ['AWS::EC2::VPC', 'AWS::EC2::Subnet', 'AWS::ECS::Cluster', 'AWS::IAM::Role'];

    await storage.put('stack', stack, {
      ...record,
      stackStatus: 'DELETE_COMPLETE',
      lastEventAt: new Date().toISOString(),
    });

    await storage.delete('stack', stack);

    return {
      variant: 'ok',
      stack,
      destroyed,
    };
  },
};
