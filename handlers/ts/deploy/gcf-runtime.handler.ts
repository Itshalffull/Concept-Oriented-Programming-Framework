// GcfRuntime Concept Implementation
// Google Cloud Functions provider for the Runtime coordination concept. Manages
// function provisioning, source deployment, traffic shifting, and teardown.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'gcf';

export const gcfRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const projectId = input.projectId as string;
    const region = input.region as string;
    const runtime = input.runtime as string;
    const triggerType = input.triggerType as string;

    const functionId = `gcf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const endpoint = `https://${region}-${projectId}.cloudfunctions.net/${concept}`;

    await storage.put(RELATION, functionId, {
      function: functionId,
      concept,
      projectId,
      region,
      runtime,
      triggerType,
      environment: 'GEN_2',
      endpoint,
      currentVersion: '',
      status: 'provisioned',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', function: functionId, endpoint };
  },

  async deploy(input, storage) {
    const fn = input.function as string;
    const sourceArchive = input.sourceArchive as string;

    const record = await storage.get(RELATION, fn);
    if (!record) {
      return { variant: 'buildFailed', function: fn, errors: ['Function not found'] };
    }

    const version = `v${Date.now()}`;

    await storage.put(RELATION, fn, {
      ...record,
      currentVersion: version,
      sourceArchive,
      status: 'deployed',
      deployedAt: new Date().toISOString(),
    });

    return { variant: 'ok', function: fn, version };
  },

  async setTrafficWeight(input, storage) {
    const fn = input.function as string;
    const weight = input.weight as number;

    const record = await storage.get(RELATION, fn);
    if (record) {
      await storage.put(RELATION, fn, { ...record, trafficWeight: weight });
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
