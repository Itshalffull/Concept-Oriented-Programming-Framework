// @migrated dsl-constructs 2026-03-18
// GcfRuntime Concept Implementation
// Manage Google Cloud Functions deployments. Owns function names, trigger
// configurations, gen1 and gen2 distinctions, and invocation metrics.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const gcfRuntimeHandler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const projectId = input.projectId as string;
    const region = input.region as string;
    const runtime = input.runtime as string;
    const triggerType = input.triggerType as string;

    // Check for gen2 requirement
    if (triggerType === 'eventarc' || triggerType === 'cloudevent') {
      const p = createProgram();
      return complete(p, 'gen2Required', {
        concept,
        reason: `Trigger type '${triggerType}' requires Cloud Functions gen2`,
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const functionId = `gcf-${concept.toLowerCase()}-${Date.now()}`;
    const functionName = `${concept.toLowerCase()}-fn`;
    const endpoint = triggerType === 'http'
      ? `https://${region}-${projectId}.cloudfunctions.net/${functionName}`
      : `projects/${projectId}/locations/${region}/functions/${functionName}`;

    let p = createProgram();
    p = put(p, 'function', functionId, {
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

    return complete(p, 'ok', {
      function: functionId,
      endpoint,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  deploy(input: Record<string, unknown>) {
    const fn = input.function as string;
    const sourceArchive = input.sourceArchive as string;

    if (sourceArchive.includes('invalid') || sourceArchive.includes('corrupt')) {
      const p = createProgram();
      return complete(p, 'buildFailed', {
        function: fn,
        errors: ['Cloud Build failed: source archive is invalid or corrupt'],
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'function', fn, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'function', fn, {
          lastDeployedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { function: fn, version: '' });
      },
      (b) => complete(b, 'buildFailed', {
        function: fn,
        errors: ['Function not found in storage'],
      }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setTrafficWeight(input: Record<string, unknown>) {
    const fn = input.function as string;
    const weight = input.weight as number;

    let p = createProgram();
    p = spGet(p, 'function', fn, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'function', fn, { trafficWeight: weight });
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
        return complete(b2, 'ok', { function: fn, restoredVersion: targetVersion });
      },
      (b) => complete(b, 'ok', { function: fn, restoredVersion: targetVersion }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  destroy(input: Record<string, unknown>) {
    const fn = input.function as string;

    let p = createProgram();
    p = del(p, 'function', fn);
    return complete(p, 'ok', { function: fn }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
