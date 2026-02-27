// Runtime Concept Implementation
// Coordination concept for runtime lifecycle. Manages provisioning, deployment,
// traffic shifting, rollback, and health checking across provider backends.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'runtime';

export const runtimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const runtimeType = input.runtimeType as string;
    const config = input.config as string;

    // Check if already provisioned
    const existing = await storage.find(RELATION, { concept, runtimeType });
    if (existing.length > 0) {
      const rec = existing[0];
      return {
        variant: 'alreadyProvisioned',
        instance: rec.instance as string,
        endpoint: rec.endpoint as string,
      };
    }

    const instanceId = `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const endpoint = 'http://svc:8080';

    await storage.put(RELATION, instanceId, {
      instance: instanceId,
      concept,
      runtimeType,
      config,
      endpoint,
      currentVersion: '',
      trafficWeight: 0,
      status: 'provisioned',
      history: JSON.stringify([]),
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', instance: instanceId, endpoint };
  },

  async deploy(input, storage) {
    const instance = input.instance as string;
    const artifact = input.artifact as string;
    const version = input.version as string;

    const record = await storage.get(RELATION, instance);
    if (!record) {
      return { variant: 'deployFailed', instance, reason: 'Instance not found' };
    }

    const history: Array<{ version: string; deployedAt: string }> = JSON.parse(record.history as string || '[]');
    if (record.currentVersion) {
      history.push({ version: record.currentVersion as string, deployedAt: new Date().toISOString() });
    }

    await storage.put(RELATION, instance, {
      ...record,
      currentVersion: version,
      artifact,
      status: 'deployed',
      history: JSON.stringify(history),
      deployedAt: new Date().toISOString(),
    });

    return { variant: 'ok', instance, endpoint: record.endpoint as string };
  },

  async setTrafficWeight(input, storage) {
    const instance = input.instance as string;
    const weight = input.weight as number;

    const record = await storage.get(RELATION, instance);
    if (record) {
      await storage.put(RELATION, instance, {
        ...record,
        trafficWeight: weight,
      });
    }

    return { variant: 'ok', instance, newWeight: weight };
  },

  async rollback(input, storage) {
    const instance = input.instance as string;

    const record = await storage.get(RELATION, instance);
    if (!record) {
      return { variant: 'rollbackFailed', instance, reason: 'Instance not found' };
    }

    const history: Array<{ version: string; deployedAt: string }> = JSON.parse(record.history as string || '[]');
    if (history.length === 0) {
      return { variant: 'noHistory', instance };
    }

    const previous = history.pop()!;
    await storage.put(RELATION, instance, {
      ...record,
      currentVersion: previous.version,
      status: 'rolledback',
      history: JSON.stringify(history),
    });

    return { variant: 'ok', instance, previousVersion: previous.version };
  },

  async destroy(input, storage) {
    const instance = input.instance as string;

    const record = await storage.get(RELATION, instance);
    if (!record) {
      return { variant: 'destroyFailed', instance, reason: 'Instance not found' };
    }

    await storage.del(RELATION, instance);
    return { variant: 'ok', instance };
  },

  async healthCheck(input, storage) {
    const instance = input.instance as string;

    const record = await storage.get(RELATION, instance);
    if (!record) {
      return { variant: 'unreachable', instance };
    }

    const latencyMs = Math.round(Math.random() * 50 + 5);
    return { variant: 'ok', instance, latencyMs };
  },
};
