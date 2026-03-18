// @migrated dsl-constructs 2026-03-18
// CloudflareRuntime Concept Implementation
// Cloudflare Workers provider for the Runtime coordination concept. Manages
// worker script provisioning, deployment, traffic splitting, and teardown.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'cloudflare';

const _cloudflareRuntimeHandler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const accountId = input.accountId as string;
    const routes = input.routes as string[];

    const workerId = `wkr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const scriptName = `${concept}-worker`;
    const endpoint = `https://${scriptName}.${accountId}.workers.dev`;

    let p = createProgram();
    p = put(p, RELATION, workerId, {
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

    return complete(p, 'ok', { worker: workerId, scriptName, endpoint }) as StorageProgram<Result>;
  },

  deploy(input: Record<string, unknown>) {
    const worker = input.worker as string;
    const scriptContent = input.scriptContent as string;

    let p = createProgram();
    p = get(p, RELATION, worker, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = mapBindings(thenP, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const prevVersion = record.currentVersion as string || '0';
          const versionNum = prevVersion ? parseInt(prevVersion, 10) || 0 : 0;
          return String(versionNum + 1);
        }, 'version');

        thenP = putFrom(thenP, RELATION, worker, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const version = bindings.version as string;
          return {
            ...record,
            currentVersion: version,
            scriptContent,
            status: 'deployed',
            deployedAt: new Date().toISOString(),
          };
        });

        return completeFrom(thenP, 'ok', (bindings) => ({
          worker,
          version: bindings.version as string,
        }));
      },
      (elseP) => complete(elseP, 'scriptTooLarge', { worker, sizeBytes: 0, limitBytes: 10485760 }),
    ) as StorageProgram<Result>;
  },

  setTrafficWeight(input: Record<string, unknown>) {
    const worker = input.worker as string;
    const weight = input.weight as number;

    let p = createProgram();
    p = get(p, RELATION, worker, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, RELATION, worker, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, trafficWeight: weight };
        });
        return complete(thenP, 'ok', { worker });
      },
      (elseP) => complete(elseP, 'ok', { worker }),
    ) as StorageProgram<Result>;
  },

  rollback(input: Record<string, unknown>) {
    const worker = input.worker as string;
    const targetVersion = input.targetVersion as string;

    let p = createProgram();
    p = get(p, RELATION, worker, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, RELATION, worker, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            currentVersion: targetVersion,
            status: 'rolledback',
          };
        });
        return complete(thenP, 'ok', { worker, restoredVersion: targetVersion });
      },
      (elseP) => complete(elseP, 'ok', { worker, restoredVersion: targetVersion }),
    ) as StorageProgram<Result>;
  },

  destroy(input: Record<string, unknown>) {
    const worker = input.worker as string;

    let p = createProgram();
    p = get(p, RELATION, worker, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = del(thenP, RELATION, worker);
        return complete(thenP, 'ok', { worker });
      },
      (elseP) => complete(elseP, 'ok', { worker }),
    ) as StorageProgram<Result>;
  },
};

export const cloudflareRuntimeHandler = autoInterpret(_cloudflareRuntimeHandler);
