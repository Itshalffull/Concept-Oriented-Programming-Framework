// GcfRuntime Concept Implementation
// Manage Google Cloud Functions deployments. Owns function names, trigger
// configurations, gen1 and gen2 distinctions, and invocation metrics.
import type { ConceptHandler } from '@clef/runtime';

export const gcfRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const projectId = input.projectId as string;
    const region = input.region as string;
    const runtime = input.runtime as string;
    const triggerType = input.triggerType as string;

    // Check for gen2 requirement
    if (triggerType === 'eventarc' || triggerType === 'cloudevent') {
      return {
        variant: 'gen2Required',
        concept,
        reason: `Trigger type '${triggerType}' requires Cloud Functions gen2`,
      };
    }

    const functionId = `gcf-${concept.toLowerCase()}-${Date.now()}`;
    const functionName = `${concept.toLowerCase()}-fn`;
    const endpoint = triggerType === 'http'
      ? `https://${region}-${projectId}.cloudfunctions.net/${functionName}`
      : `projects/${projectId}/locations/${region}/functions/${functionName}`;

    await storage.put('function', functionId, {
      functionName,
      projectId,
      region,
      runtime,
      entryPoint: 'handler',
      triggerType,
      environment: 'gen1',
      lastInvokedAt: null,
      invocationCount: 0,
      currentVersion: '0',
      createdAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      function: functionId,
      endpoint,
    };
  },

  async deploy(input, storage) {
    const fn = input.function as string;
    const sourceArchive = input.sourceArchive as string;

    const record = await storage.get('function', fn);
    if (!record) {
      return {
        variant: 'buildFailed',
        function: fn,
        errors: ['Function not found in storage'],
      };
    }

    if (sourceArchive.includes('invalid') || sourceArchive.includes('corrupt')) {
      return {
        variant: 'buildFailed',
        function: fn,
        errors: ['Cloud Build failed: source archive is invalid or corrupt'],
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
    const weight = input.weight as number;

    const record = await storage.get('function', fn);
    if (record) {
      await storage.put('function', fn, {
        ...record,
        trafficWeight: weight,
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

    await storage.delete('function', fn);

    return { variant: 'ok', function: fn };
  },
};
