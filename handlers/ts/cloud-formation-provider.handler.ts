// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// CloudFormationProvider Handler
//
// Generate and apply AWS CloudFormation templates from Clef
// deploy plans. Owns stack IDs, change set management,
// rollback configurations, and stack event tracking.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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

const _handler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    if (!input.plan || (typeof input.plan === 'string' && (input.plan as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'plan is required' }) as StorageProgram<Result>;
    }
    const plan = input.plan as string;

    const stackName = `clef-${plan}`;
    const region = 'us-east-1';

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
    let p = createProgram();
    p = put(p, 'cloud-formation-provider', id, {
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

    return complete(p, 'ok', {
      stack: id,
      files: [templateFileName],
    }) as StorageProgram<Result>;
  },

  preview(input: Record<string, unknown>) {
    if (!input.stack || (typeof input.stack === 'string' && (input.stack as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'stack is required' }) as StorageProgram<Result>;
    }
    const stack = input.stack as string;

    let p = createProgram();
    p = get(p, 'cloud-formation-provider', stack, 'record');

    return branch(p, 'record',
      (thenP) => {
        const changeSetId = generateChangeSetId();
        thenP = putFrom(thenP, 'cloud-formation-provider', stack, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, changeSetId, lastEventAt: new Date().toISOString() };
        });
        return complete(thenP, 'ok', {
          stack,
          changeSetId,
          toCreate: 1,
          toUpdate: 0,
          toDelete: 0,
        });
      },
      (elseP) => complete(elseP, 'changeSetEmpty', { stack }),
    ) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    if (!input.stack || (typeof input.stack === 'string' && (input.stack as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'stack is required' }) as StorageProgram<Result>;
    }
    const stack = input.stack as string;

    let p = createProgram();
    p = get(p, 'cloud-formation-provider', stack, 'record');

    return branch(p, 'record',
      (thenP) => {
        return branch(thenP,
          (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            const capabilities = JSON.parse((record.capabilities as string) || '[]') as string[];
            const requiredCapabilities = ['CAPABILITY_IAM'];
            return requiredCapabilities.some(c => !capabilities.includes(c));
          },
          (insuffP) => complete(insuffP, 'insufficientCapabilities', {
            stack,
            required: ['CAPABILITY_IAM'],
          }),
          (okP) => {
            const stackId = generateStackId();
            const now = new Date().toISOString();
            okP = putFrom(okP, 'cloud-formation-provider', stack, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { ...record, stackId, stackStatus: 'CREATE_COMPLETE', lastEventAt: now };
            });
            return complete(okP, 'ok', {
              stack,
              stackId,
              created: ['CopfResourceGroup'],
              updated: [],
            });
          },
        );
      },
      (elseP) => complete(elseP, 'ok', { stack, reason: `Stack '${stack}' not found` }),
    ) as StorageProgram<Result>;
  },

  teardown(input: Record<string, unknown>) {
    if (!input.stack || (typeof input.stack === 'string' && (input.stack as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'stack is required' }) as StorageProgram<Result>;
    }
    const stack = input.stack as string;

    let p = createProgram();
    p = get(p, 'cloud-formation-provider', stack, 'record');

    return branch(p, 'record',
      (thenP) => {
        const destroyed = ['CopfResourceGroup'];
        const now = new Date().toISOString();
        thenP = putFrom(thenP, 'cloud-formation-provider', stack, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, stackStatus: 'DELETE_COMPLETE', lastEventAt: now };
        });
        thenP = del(thenP, 'cloud-formation-provider', stack);
        return complete(thenP, 'ok', { stack, destroyed });
      },
      (elseP) => complete(elseP, 'deletionFailed', { stack, resource: 'unknown', reason: `Stack '${stack}' not found` }),
    ) as StorageProgram<Result>;
  },
};

export const cloudFormationProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetCloudFormationProviderCounter(): void {
  idCounter = 0;
}
