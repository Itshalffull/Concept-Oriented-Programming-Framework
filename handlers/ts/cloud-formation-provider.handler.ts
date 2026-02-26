// ============================================================
// CloudFormationProvider Handler
//
// Generate and apply AWS CloudFormation templates from Clef
// deploy plans. Owns stack IDs, change set management,
// rollback configurations, and stack event tracking.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `cloud-formation-provider-${++idCounter}`;
}

function generateStackId(): string {
  const region = 'us-east-1';
  const accountId = '123456789012';
  const hex = Math.random().toString(16).substring(2, 14);
  return `arn:aws:cloudformation:${region}:${accountId}:stack/clef-stack-${hex}`;
}

function generateChangeSetId(): string {
  const hex = Math.random().toString(16).substring(2, 14);
  return `changeset-${hex}`;
}

export const cloudFormationProviderHandler: ConceptHandler = {
  async generate(input: Record<string, unknown>, storage: ConceptStorage) {
    const plan = input.plan as string;

    // Derive stack name from plan identifier
    const stackName = `clef-${plan}`;
    const region = 'us-east-1';

    // Generate a basic CloudFormation template
    const template = {
      AWSTemplateFormatVersion: '2010-09-09',
      Description: `CloudFormation stack generated from Clef deploy plan: ${plan}`,
      Resources: {
        CopfResourceGroup: {
          Type: 'AWS::CloudFormation::WaitConditionHandle',
          Properties: {},
        },
      },
      Outputs: {
        StackName: {
          Value: { Ref: 'AWS::StackName' },
        },
      },
    };

    const templateContent = JSON.stringify(template, null, 2);
    const templateFileName = `${stackName}-template.yaml`;

    const id = nextId();
    const now = new Date().toISOString();
    await storage.put('cloud-formation-provider', id, {
      id,
      stackName,
      region,
      templateUrl: null,
      capabilities: JSON.stringify(['CAPABILITY_IAM']),
      stackId: null,
      changeSetId: null,
      lastEventAt: null,
      stackStatus: 'NOT_CREATED',
      plan,
      templateContent,
      createdAt: now,
    });

    return {
      variant: 'ok',
      stack: id,
      files: [templateFileName],
    };
  },

  async preview(input: Record<string, unknown>, storage: ConceptStorage) {
    const stack = input.stack as string;

    const record = await storage.get('cloud-formation-provider', stack);
    if (!record) {
      return { variant: 'changeSetEmpty', stack };
    }

    const changeSetId = generateChangeSetId();

    await storage.put('cloud-formation-provider', stack, {
      ...record,
      changeSetId,
      lastEventAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      stack,
      changeSetId,
      toCreate: 1,
      toUpdate: 0,
      toDelete: 0,
    };
  },

  async apply(input: Record<string, unknown>, storage: ConceptStorage) {
    const stack = input.stack as string;

    const record = await storage.get('cloud-formation-provider', stack);
    if (!record) {
      return { variant: 'rollbackComplete', stack, reason: `Stack '${stack}' not found` };
    }

    const capabilities = JSON.parse((record.capabilities as string) || '[]') as string[];
    const requiredCapabilities = ['CAPABILITY_IAM'];
    const missingCapabilities = requiredCapabilities.filter(c => !capabilities.includes(c));
    if (missingCapabilities.length > 0) {
      return {
        variant: 'insufficientCapabilities',
        stack,
        required: missingCapabilities,
      };
    }

    const stackId = generateStackId();
    const now = new Date().toISOString();

    await storage.put('cloud-formation-provider', stack, {
      ...record,
      stackId,
      stackStatus: 'CREATE_COMPLETE',
      lastEventAt: now,
    });

    return {
      variant: 'ok',
      stack,
      stackId,
      created: ['CopfResourceGroup'],
      updated: [],
    };
  },

  async teardown(input: Record<string, unknown>, storage: ConceptStorage) {
    const stack = input.stack as string;

    const record = await storage.get('cloud-formation-provider', stack);
    if (!record) {
      return { variant: 'deletionFailed', stack, resource: 'unknown', reason: `Stack '${stack}' not found` };
    }

    const destroyed = ['CopfResourceGroup'];
    const now = new Date().toISOString();

    await storage.put('cloud-formation-provider', stack, {
      ...record,
      stackStatus: 'DELETE_COMPLETE',
      lastEventAt: now,
    });

    await storage.del('cloud-formation-provider', stack);

    return {
      variant: 'ok',
      stack,
      destroyed,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetCloudFormationProviderCounter(): void {
  idCounter = 0;
}
