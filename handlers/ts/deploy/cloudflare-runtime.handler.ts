// CloudflareRuntime Concept Implementation
// Cloudflare Workers provider for the Runtime coordination concept. Manages
// worker script provisioning, deployment, traffic splitting, and teardown.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'cloudflare';

export const cloudflareRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const accountId = input.accountId as string;
    const routes = input.routes as string[];

    const workerId = `wkr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const scriptName = `${concept}-worker`;
    const endpoint = `https://${scriptName}.${accountId}.workers.dev`;

    await storage.put(RELATION, workerId, {
      worker: workerId,
      concept,
      accountId,
      scriptName,
      routes: JSON.stringify(routes),
      endpoint,
      currentVersion: '',
      status: 'provisioned',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', worker: workerId, scriptName, endpoint };
  },

  async deploy(input, storage) {
    const worker = input.worker as string;
    const scriptContent = input.scriptContent as string;

    const record = await storage.get(RELATION, worker);
    if (!record) {
      return { variant: 'scriptTooLarge', worker, sizeBytes: 0, limitBytes: 10485760 };
    }

    const prevVersion = record.currentVersion as string || '0';
    const versionNum = prevVersion ? parseInt(prevVersion, 10) || 0 : 0;
    const version = String(versionNum + 1);

    await storage.put(RELATION, worker, {
      ...record,
      currentVersion: version,
      scriptContent,
      status: 'deployed',
      deployedAt: new Date().toISOString(),
    });

    return { variant: 'ok', worker, version };
  },

  async setTrafficWeight(input, storage) {
    const worker = input.worker as string;
    const weight = input.weight as number;

    const record = await storage.get(RELATION, worker);
    if (record) {
      await storage.put(RELATION, worker, { ...record, trafficWeight: weight });
    }

    return { variant: 'ok', worker };
  },

  async rollback(input, storage) {
    const worker = input.worker as string;
    const targetVersion = input.targetVersion as string;

    const record = await storage.get(RELATION, worker);
    if (record) {
      await storage.put(RELATION, worker, {
        ...record,
        currentVersion: targetVersion,
        status: 'rolledback',
      });
    }

    return { variant: 'ok', worker, restoredVersion: targetVersion };
  },

  async destroy(input, storage) {
    const worker = input.worker as string;

    const record = await storage.get(RELATION, worker);
    if (!record) {
      return { variant: 'ok', worker };
    }

    await storage.del(RELATION, worker);
    return { variant: 'ok', worker };
  },
};
