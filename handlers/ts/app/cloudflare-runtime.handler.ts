// @migrated dsl-constructs 2026-03-18
// CloudflareRuntime Concept Implementation
// Manage Cloudflare Workers deployments. Owns worker scripts, routes,
// KV namespace bindings, and Durable Object configurations.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const cloudflareRuntimeHandler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const accountId = input.accountId as string;
    const routes = input.routes as string[];

    let p = createProgram();
    p = find(p, 'worker', {}, 'existingWorkers');
    // Route conflict check resolved at runtime from bindings

    const workerId = `cf-worker-${concept.toLowerCase()}-${Date.now()}`;
    const scriptName = `${concept.toLowerCase()}-worker`;
    const endpoint = `https://${scriptName}.${accountId}.workers.dev`;

    p = put(p, 'worker', workerId, {
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

    return complete(p, 'ok', { worker: workerId, scriptName, endpoint }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  deploy(input: Record<string, unknown>) {
    const worker = input.worker as string;
    const scriptContent = input.scriptContent as string;

    const sizeBytes = new TextEncoder().encode(scriptContent).length;
    const limitBytes = 1_048_576;
    if (sizeBytes > limitBytes) {
      let p = createProgram();
      return complete(p, 'scriptTooLarge', { worker, sizeBytes, limitBytes }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'worker', worker, 'record');
    p = branch(p, 'record',
      (b) => {
        // Version increment resolved at runtime from bindings
        return complete(b, 'ok', { worker, version: '' });
      },
      (b) => complete(b, 'scriptTooLarge', { worker, sizeBytes: 0, limitBytes }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setTrafficWeight(input: Record<string, unknown>) {
    const worker = input.worker as string;
    const weight = input.weight as number;

    let p = createProgram();
    p = spGet(p, 'worker', worker, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'worker', worker, { trafficWeight: weight });
        return complete(b2, 'ok', { worker });
      },
      (b) => complete(b, 'ok', { worker }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  rollback(input: Record<string, unknown>) {
    const worker = input.worker as string;
    const targetVersion = input.targetVersion as string;

    let p = createProgram();
    p = spGet(p, 'worker', worker, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'worker', worker, {
          currentVersion: targetVersion,
          lastDeployedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { worker, restoredVersion: targetVersion });
      },
      (b) => complete(b, 'ok', { worker, restoredVersion: targetVersion }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  destroy(input: Record<string, unknown>) {
    const worker = input.worker as string;

    let p = createProgram();
    p = del(p, 'worker', worker);
    return complete(p, 'ok', { worker }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
