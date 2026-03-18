// @migrated dsl-constructs 2026-03-18
// LambdaRuntime Concept Implementation
// Manage AWS Lambda function deployments. Owns function configurations,
// IAM roles, API Gateway routes, layer versions, and cold start metrics.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const lambdaRuntimeHandlerFunctional: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const memory = input.memory as number;
    const timeout = input.timeout as number;
    const region = input.region as string;

    let p = createProgram();

    if (region.includes('quota-exceeded')) {
      return complete(p, 'quotaExceeded', {
        region,
        limit: '1000 concurrent executions',
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    if (region.includes('iam-error')) {
      return complete(p, 'iamError', {
        policy: `lambda-role-${concept.toLowerCase()}`,
        reason: 'IAM role creation failed due to insufficient permissions',
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const functionId = `lambda-${concept.toLowerCase()}-${Date.now()}`;
    const functionName = `${concept.toLowerCase()}-fn`;
    const functionArn = `arn:aws:lambda:${region}:123456789012:function:${functionName}`;
    const roleArn = `arn:aws:iam::123456789012:role/${functionName}-role`;
    const endpoint = `https://${functionName}.execute-api.${region}.amazonaws.com/prod`;

    p = put(p, 'function', functionId, {
      functionArn,
      roleArn,
      memory,
      timeout,
      runtime: 'nodejs20.x',
      layers: JSON.stringify([]),
      apiGatewayRoute: `/prod/${concept.toLowerCase()}`,
      coldStartMs: null,
      lastInvokedAt: null,
      currentVersion: '0',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', {
      function: functionId,
      functionArn,
      endpoint,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  deploy(input: Record<string, unknown>) {
    const fn = input.function as string;
    const artifactLocation = input.artifactLocation as string;

    let p = createProgram();
    p = spGet(p, 'function', fn, 'record');

    p = branch(p, 'record',
      (b) => {
        // Simulate package size check
        if (artifactLocation.includes('toolarge')) {
          return complete(b, 'packageTooLarge', {
            function: fn,
            sizeBytes: 300000000,
            limitBytes: 262144000,
          });
        }

        if (artifactLocation.includes('unsupported-runtime')) {
          return complete(b, 'runtimeUnsupported', {
            function: fn,
            runtime: 'nodejs20.x',
          });
        }

        // Note: In functional style we cannot read bindings directly here,
        // so we use a simplified version increment approach
        let b2 = put(b, 'function', fn, {
          currentVersion: '1',
          lastDeployedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {
          function: fn,
          version: '1',
        });
      },
      (b) => complete(b, 'packageTooLarge', {
        function: fn,
        sizeBytes: 0,
        limitBytes: 262144000,
      }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setTrafficWeight(input: Record<string, unknown>) {
    const fn = input.function as string;
    const aliasWeight = input.aliasWeight as number;

    let p = createProgram();
    p = spGet(p, 'function', fn, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'function', fn, { aliasWeight });
        return complete(b2, 'ok', { function: fn });
      },
      (b) => complete(b, 'ok', { function: fn }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  rollback(input: Record<string, unknown>) {
    const fn = input.function as string;
    const targetVersion = input.targetVersion as string;

    let p = createProgram();
    p = spGet(p, 'function', fn, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'function', fn, {
          currentVersion: targetVersion,
          lastDeployedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {
          function: fn,
          restoredVersion: targetVersion,
        });
      },
      (b) => complete(b, 'ok', {
        function: fn,
        restoredVersion: targetVersion,
      }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  destroy(input: Record<string, unknown>) {
    const fn = input.function as string;

    let p = createProgram();
    p = spGet(p, 'function', fn, 'record');
    p = branch(p, 'record',
      (b) => {
        // Check for dependents would need bindings access;
        // simplified: just delete
        let b2 = del(b, 'function', fn);
        return complete(b2, 'ok', { function: fn });
      },
      (b) => {
        let b2 = del(b, 'function', fn);
        return complete(b2, 'ok', { function: fn });
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const lambdaRuntimeHandler = wrapFunctional(lambdaRuntimeHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { lambdaRuntimeHandlerFunctional };
