// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// LambdaRuntime Concept Implementation
// AWS Lambda provider for the Runtime coordination concept. Manages
// Lambda function provisioning, deployment, traffic shifting, and teardown.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'lambda';

const _handler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    if (!input.concept || (typeof input.concept === 'string' && (input.concept as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'concept is required' }) as StorageProgram<Result>;
    }
    const concept = input.concept as string;
    const memory = input.memory as number;
    const timeout = input.timeout as number;
    const region = input.region as string;

    const functionId = `fn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const functionArn = `arn:aws:lambda:${region}:123456789:function:${concept}`;
    const endpoint = `https://${functionId}.lambda-url.${region}.on.aws`;

    let p = createProgram();
    p = put(p, RELATION, functionId, {
      function: functionId,
      concept,
      functionArn,
      endpoint,
      memory,
      timeout,
      region,
      currentVersion: '',
      aliasWeight: 100,
      invocations: 0,
      errors: 0,
      p99Latency: 0,
      status: 'provisioned',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { function: functionId, functionArn, endpoint }) as StorageProgram<Result>;
  },

  deploy(input: Record<string, unknown>) {
    if (!input.function || (typeof input.function === 'string' && (input.function as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'function is required' }) as StorageProgram<Result>;
    }
    const fn = input.function as string;
    const artifactLocation = input.artifactLocation as string;

    let p = createProgram();
    p = get(p, RELATION, fn, 'record');

    p = branch(p,
      (bindings) => !bindings.record,
      (b) => complete(b, 'runtimeUnsupported', { function: fn, runtime: 'unknown' }),
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const prevVersion = record.currentVersion as string || '0';
          const versionNum = prevVersion ? parseInt(prevVersion, 10) || 0 : 0;
          return String(versionNum + 1);
        }, 'version');

        b2 = putFrom(b2, RELATION, fn, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            currentVersion: bindings.version as string,
            artifactLocation,
            status: 'deployed',
            deployedAt: new Date().toISOString(),
          };
        });

        return completeFrom(b2, 'ok', (bindings) => ({
          function: fn,
          version: bindings.version as string,
        }));
      },
    );

    return p as StorageProgram<Result>;
  },

  setTrafficWeight(input: Record<string, unknown>) {
    if (!input.function || (typeof input.function === 'string' && (input.function as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'function is required' }) as StorageProgram<Result>;
    }
    const fn = input.function as string;
    const aliasWeight = input.aliasWeight as number;

    let p = createProgram();
    p = get(p, RELATION, fn, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = putFrom(b, RELATION, fn, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, aliasWeight };
        });
        return complete(b2, 'ok', { function: fn });
      },
      (b) => complete(b, 'ok', { function: fn }),
    );

    return p as StorageProgram<Result>;
  },

  rollback(input: Record<string, unknown>) {
    if (!input.targetVersion || (typeof input.targetVersion === 'string' && (input.targetVersion as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'targetVersion is required' }) as StorageProgram<Result>;
    }
    const fn = input.function as string;
    const targetVersion = input.targetVersion as string;

    let p = createProgram();
    p = get(p, RELATION, fn, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = putFrom(b, RELATION, fn, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            currentVersion: targetVersion,
            status: 'rolledback',
          };
        });
        return complete(b2, 'ok', { function: fn, restoredVersion: targetVersion });
      },
      (b) => complete(b, 'ok', { function: fn, restoredVersion: targetVersion }),
    );

    return p as StorageProgram<Result>;
  },

  destroy(input: Record<string, unknown>) {
    if (!input.function || (typeof input.function === 'string' && (input.function as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'function is required' }) as StorageProgram<Result>;
    }
    const fn = input.function as string;

    let p = createProgram();
    p = get(p, RELATION, fn, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = del(b, RELATION, fn);
        return complete(b2, 'ok', { function: fn });
      },
      (b) => complete(b, 'ok', { function: fn }),
    );

    return p as StorageProgram<Result>;
  },
};

export const lambdaRuntimeHandler = autoInterpret(_handler);
