// LambdaRuntime Concept Implementation
// Manage AWS Lambda function deployments. Owns function configurations,
// IAM roles, API Gateway routes, layer versions, and cold start metrics.
import type { ConceptHandler } from '@clef/runtime';

export const lambdaRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const memory = input.memory as number;
    const timeout = input.timeout as number;
    const region = input.region as string;

    if (region.includes('quota-exceeded')) {
      return {
        variant: 'quotaExceeded',
        region,
        limit: '1000 concurrent executions',
      };
    }

    if (region.includes('iam-error')) {
      return {
        variant: 'iamError',
        policy: `lambda-role-${concept.toLowerCase()}`,
        reason: 'IAM role creation failed due to insufficient permissions',
      };
    }

    const functionId = `lambda-${concept.toLowerCase()}-${Date.now()}`;
    const functionName = `${concept.toLowerCase()}-fn`;
    const functionArn = `arn:aws:lambda:${region}:123456789012:function:${functionName}`;
    const roleArn = `arn:aws:iam::123456789012:role/${functionName}-role`;
    const endpoint = `https://${functionName}.execute-api.${region}.amazonaws.com/prod`;

    await storage.put('function', functionId, {
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

    return {
      variant: 'ok',
      function: functionId,
      functionArn,
      endpoint,
    };
  },

  async deploy(input, storage) {
    const fn = input.function as string;
    const artifactLocation = input.artifactLocation as string;

    const record = await storage.get('function', fn);
    if (!record) {
      return {
        variant: 'packageTooLarge',
        function: fn,
        sizeBytes: 0,
        limitBytes: 262144000,
      };
    }

    // Simulate package size check
    if (artifactLocation.includes('toolarge')) {
      return {
        variant: 'packageTooLarge',
        function: fn,
        sizeBytes: 300000000,
        limitBytes: 262144000,
      };
    }

    const runtime = record.runtime as string;
    if (artifactLocation.includes('unsupported-runtime')) {
      return {
        variant: 'runtimeUnsupported',
        function: fn,
        runtime,
      };
    }

    const currentVersion = parseInt(record.currentVersion as string, 10);
    const newVersion = String(currentVersion + 1);

    await storage.put('function', fn, {
      ...record,
      currentVersion: newVersion,
      lastDeployedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      function: fn,
      version: newVersion,
    };
  },

  async setTrafficWeight(input, storage) {
    const fn = input.function as string;
    const aliasWeight = input.aliasWeight as number;

    const record = await storage.get('function', fn);
    if (record) {
      await storage.put('function', fn, {
        ...record,
        aliasWeight,
      });
    }

    return { variant: 'ok', function: fn };
  },

  async rollback(input, storage) {
    const fn = input.function as string;
    const targetVersion = input.targetVersion as string;

    const record = await storage.get('function', fn);
    if (record) {
      await storage.put('function', fn, {
        ...record,
        currentVersion: targetVersion,
        lastDeployedAt: new Date().toISOString(),
      });
    }

    return {
      variant: 'ok',
      function: fn,
      restoredVersion: targetVersion,
    };
  },

  async destroy(input, storage) {
    const fn = input.function as string;

    const record = await storage.get('function', fn);
    if (record) {
      // Check for dependents
      const dependents = record.dependents as string[] | undefined;
      if (dependents && dependents.length > 0) {
        return {
          variant: 'resourceInUse',
          function: fn,
          dependents,
        };
      }
    }

    await storage.delete('function', fn);

    return { variant: 'ok', function: fn };
  },
};
