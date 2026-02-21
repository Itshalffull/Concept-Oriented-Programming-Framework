// CloudflareRuntime Concept Implementation
// Manage Cloudflare Workers deployments. Owns worker scripts, routes,
// KV namespace bindings, and Durable Object configurations.
import type { ConceptHandler } from '@copf/kernel';

export const cloudflareRuntimeHandler: ConceptHandler = {
  async provision(input, storage) {
    const concept = input.concept as string;
    const accountId = input.accountId as string;
    const routes = input.routes as string[];

    // Check for route conflicts against existing workers
    const existingWorkers = await storage.find('worker');
    for (const existing of existingWorkers) {
      const existingRoutes: string[] = JSON.parse(existing.routes as string);
      for (const route of routes) {
        if (existingRoutes.includes(route)) {
          return {
            variant: 'routeConflict',
            route,
            existingWorker: existing.scriptName as string,
          };
        }
      }
    }

    const workerId = `cf-worker-${concept.toLowerCase()}-${Date.now()}`;
    const scriptName = `${concept.toLowerCase()}-worker`;
    const endpoint = `https://${scriptName}.${accountId}.workers.dev`;

    await storage.put('worker', workerId, {
      scriptName,
      accountId,
      routes: JSON.stringify(routes),
      kvNamespaces: JSON.stringify([]),
      compatibilityDate: new Date().toISOString().split('T')[0],
      requestCount: 0,
      cpuTimeMs: 0,
      currentVersion: '0',
      createdAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      worker: workerId,
      scriptName,
      endpoint,
    };
  },

  async deploy(input, storage) {
    const worker = input.worker as string;
    const scriptContent = input.scriptContent as string;

    const sizeBytes = new TextEncoder().encode(scriptContent).length;
    const limitBytes = 1_048_576; // 1 MB limit
    if (sizeBytes > limitBytes) {
      return {
        variant: 'scriptTooLarge',
        worker,
        sizeBytes,
        limitBytes,
      };
    }

    const record = await storage.get('worker', worker);
    if (!record) {
      return {
        variant: 'scriptTooLarge',
        worker,
        sizeBytes: 0,
        limitBytes,
      };
    }

    const currentVersion = parseInt(record.currentVersion as string, 10);
    const newVersion = String(currentVersion + 1);

    await storage.put('worker', worker, {
      ...record,
      currentVersion: newVersion,
      lastDeployedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      worker,
      version: newVersion,
    };
  },

  async setTrafficWeight(input, storage) {
    const worker = input.worker as string;
    const weight = input.weight as number;

    const record = await storage.get('worker', worker);
    if (record) {
      await storage.put('worker', worker, {
        ...record,
        trafficWeight: weight,
      });
    }

    return { variant: 'ok', worker };
  },

  async rollback(input, storage) {
    const worker = input.worker as string;
    const targetVersion = input.targetVersion as string;

    const record = await storage.get('worker', worker);
    if (record) {
      await storage.put('worker', worker, {
        ...record,
        currentVersion: targetVersion,
        lastDeployedAt: new Date().toISOString(),
      });
    }

    return {
      variant: 'ok',
      worker,
      restoredVersion: targetVersion,
    };
  },

  async destroy(input, storage) {
    const worker = input.worker as string;

    await storage.delete('worker', worker);

    return { variant: 'ok', worker };
  },
};
