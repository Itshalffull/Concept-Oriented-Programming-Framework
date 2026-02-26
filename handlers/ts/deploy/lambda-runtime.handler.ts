// LambdaRuntime Concept Implementation
// AWS Lambda provider for the Runtime coordination concept. Manages
// Lambda function provisioning, deployment, traffic shifting, and teardown.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'lambda';

export const lambdaRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const memory = input.memory as number;
    const timeout = input.timeout as number;
    const region = input.region as string;

    const functionId = `fn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const functionArn = `arn:aws:lambda:${region}:123456789:function:${concept}`;
    const endpoint = `https://${functionId}.lambda-url.${region}.on.aws`;

    await storage.put(RELATION, functionId, {
      function: functionId,
      concept,
      functionArn,
      endpoint,
      memory,
      timeout,
      region,
      currentVersion: '',
      aliasWeight: 100,
      invocations: 0,
      errors: 0,
      p99Latency: 0,
      status: 'provisioned',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', function: functionId, functionArn, endpoint };
  },

  async deploy(input, storage) {
    const fn = input.function as string;
    const artifactLocation = input.artifactLocation as string;

    const record = await storage.get(RELATION, fn);
    if (!record) {
      return { variant: 'runtimeUnsupported', function: fn, runtime: 'unknown' };
    }

    const version = `v${Date.now()}`;

    await storage.put(RELATION, fn, {
      ...record,
      currentVersion: version,
      artifactLocation,
      status: 'deployed',
      deployedAt: new Date().toISOString(),
    });

    return { variant: 'ok', function: fn, version };
  },

  async setTrafficWeight(input, storage) {
    const fn = input.function as string;
    const aliasWeight = input.aliasWeight as number;

    const record = await storage.get(RELATION, fn);
    if (record) {
      await storage.put(RELATION, fn, {
        ...record,
        aliasWeight,
      });
    }

    return { variant: 'ok', function: fn };
  },

  async rollback(input, storage) {
    const fn = input.function as string;
    const targetVersion = input.targetVersion as string;

    const record = await storage.get(RELATION, fn);
    if (record) {
      await storage.put(RELATION, fn, {
        ...record,
        currentVersion: targetVersion,
        status: 'rolledback',
      });
    }

    return { variant: 'ok', function: fn, restoredVersion: targetVersion };
  },

  async destroy(input, storage) {
    const fn = input.function as string;

    const record = await storage.get(RELATION, fn);
    if (!record) {
      return { variant: 'ok', function: fn };
    }

    await storage.del(RELATION, fn);
    return { variant: 'ok', function: fn };
  },
};
