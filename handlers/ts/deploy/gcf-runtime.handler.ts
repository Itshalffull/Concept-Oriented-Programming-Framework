// @migrated dsl-constructs 2026-03-18
// GcfRuntime Concept Implementation
// Google Cloud Functions provider for the Runtime coordination concept. Manages
// function provisioning, source deployment, traffic shifting, and teardown.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'gcf';

const _gcfRuntimeHandler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const projectId = input.projectId as string;
    const region = input.region as string;
    const runtime = input.runtime as string;
    const triggerType = input.triggerType as string;

    const functionId = `gcf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const endpoint = `https://${region}-${projectId}.cloudfunctions.net/${concept}`;

    let p = createProgram();
    p = put(p, RELATION, functionId, {
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

    return complete(p, 'ok', { function: functionId, endpoint }) as StorageProgram<Result>;
  },

  deploy(input: Record<string, unknown>) {
    const fn = input.function as string;
    const sourceArchive = input.sourceArchive as string;

    let p = createProgram();
    p = get(p, RELATION, fn, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = mapBindings(thenP, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const prevVersion = record.currentVersion as string || '0';
          const versionNum = prevVersion ? parseInt(prevVersion, 10) || 0 : 0;
          return String(versionNum + 1);
        }, 'version');

        thenP = putFrom(thenP, RELATION, fn, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const version = bindings.version as string;
          return {
            ...record,
            currentVersion: version,
            sourceArchive,
            status: 'deployed',
            deployedAt: new Date().toISOString(),
          };
        });

        return completeFrom(thenP, 'ok', (bindings) => ({
          function: fn,
          version: bindings.version as string,
        }));
      },
      (elseP) => complete(elseP, 'buildFailed', { function: fn, errors: ['Function not found'] }),
    ) as StorageProgram<Result>;
  },

  setTrafficWeight(input: Record<string, unknown>) {
    const fn = input.function as string;
    const weight = input.weight as number;

    let p = createProgram();
    p = get(p, RELATION, fn, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, RELATION, fn, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, trafficWeight: weight };
        });
        return complete(thenP, 'ok', { function: fn });
      },
      (elseP) => complete(elseP, 'ok', { function: fn }),
    ) as StorageProgram<Result>;
  },

  rollback(input: Record<string, unknown>) {
    const fn = input.function as string;
    const targetVersion = input.targetVersion as string;

    let p = createProgram();
    p = get(p, RELATION, fn, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, RELATION, fn, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            currentVersion: targetVersion,
            status: 'rolledback',
          };
        });
        return complete(thenP, 'ok', { function: fn, restoredVersion: targetVersion });
      },
      (elseP) => complete(elseP, 'ok', { function: fn, restoredVersion: targetVersion }),
    ) as StorageProgram<Result>;
  },

  destroy(input: Record<string, unknown>) {
    const fn = input.function as string;

    let p = createProgram();
    p = get(p, RELATION, fn, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = del(thenP, RELATION, fn);
        return complete(thenP, 'ok', { function: fn });
      },
      (elseP) => complete(elseP, 'ok', { function: fn }),
    ) as StorageProgram<Result>;
  },
};

export const gcfRuntimeHandler = autoInterpret(_gcfRuntimeHandler);
