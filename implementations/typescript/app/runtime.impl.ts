// Runtime Concept Implementation (Deploy Kit)
// Coordinate compute provisioning across cloud providers.
import type { ConceptHandler } from '@copf/kernel';

export const runtimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const runtimeType = input.runtimeType as string;
    const config = input.config as string;

    // Check if already provisioned
    const allInstances = await storage.find('instance');
    for (const inst of allInstances) {
      if (inst.concept === concept && inst.runtimeType === runtimeType && inst.status === 'running') {
        return {
          variant: 'alreadyProvisioned',
          instance: inst.instanceId as string,
          endpoint: inst.endpoint as string,
        };
      }
    }

    const instanceId = `inst-${concept}-${Date.now()}`;
    const deployedAt = new Date().toISOString();
    const endpoint = `http://${concept.toLowerCase()}-svc:8080`;

    await storage.put('instance', instanceId, {
      instanceId,
      concept,
      runtimeType,
      endpoint,
      version: '0.0.0',
      artifactHash: '',
      deployedAt,
      status: 'running',
      activeWeight: 100,
      canaryWeight: 0,
      canaryEndpoint: null,
      history: JSON.stringify([]),
      config,
    });

    return { variant: 'ok', instance: instanceId, endpoint };
  },

  async deploy(input, storage) {
    const instance = input.instance as string;
    const artifact = input.artifact as string;
    const version = input.version as string;

    const existing = await storage.get('instance', instance);
    if (!existing) {
      return { variant: 'deployFailed', instance, reason: 'Instance not found' };
    }

    const deployedAt = new Date().toISOString();
    const history: Array<{ version: string; artifactHash: string; deployedAt: string }> =
      JSON.parse(existing.history as string);

    // Record current version in history before updating
    if (existing.version && existing.version !== '0.0.0') {
      history.push({
        version: existing.version as string,
        artifactHash: existing.artifactHash as string,
        deployedAt: existing.deployedAt as string,
      });
    }

    await storage.put('instance', instance, {
      ...existing,
      version,
      artifactHash: artifact,
      deployedAt,
      history: JSON.stringify(history),
    });

    return { variant: 'ok', instance, endpoint: existing.endpoint as string };
  },

  async setTrafficWeight(input, storage) {
    const instance = input.instance as string;
    const weight = input.weight as number;

    const existing = await storage.get('instance', instance);
    if (!existing) {
      return { variant: 'ok', instance, newWeight: 0 };
    }

    await storage.put('instance', instance, {
      ...existing,
      activeWeight: weight,
      canaryWeight: 100 - weight,
    });

    return { variant: 'ok', instance, newWeight: weight };
  },

  async rollback(input, storage) {
    const instance = input.instance as string;

    const existing = await storage.get('instance', instance);
    if (!existing) {
      return { variant: 'rollbackFailed', instance, reason: 'Instance not found' };
    }

    const history: Array<{ version: string; artifactHash: string; deployedAt: string }> =
      JSON.parse(existing.history as string);

    if (history.length === 0) {
      return { variant: 'noHistory', instance };
    }

    const previousEntry = history.pop()!;
    const deployedAt = new Date().toISOString();

    await storage.put('instance', instance, {
      ...existing,
      version: previousEntry.version,
      artifactHash: previousEntry.artifactHash,
      deployedAt,
      history: JSON.stringify(history),
    });

    return { variant: 'ok', instance, previousVersion: previousEntry.version };
  },

  async destroy(input, storage) {
    const instance = input.instance as string;

    const existing = await storage.get('instance', instance);
    if (!existing) {
      return { variant: 'destroyFailed', instance, reason: 'Instance not found' };
    }

    await storage.delete('instance', instance);

    return { variant: 'ok', instance };
  },

  async healthCheck(input, storage) {
    const instance = input.instance as string;

    const existing = await storage.get('instance', instance);
    if (!existing) {
      return { variant: 'unreachable', instance };
    }

    const status = existing.status as string;
    if (status !== 'running') {
      return { variant: 'unreachable', instance };
    }

    const latencyMs = Math.floor(Math.random() * 50) + 1;

    return { variant: 'ok', instance, latencyMs };
  },
};
