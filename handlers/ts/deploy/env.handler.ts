// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Env Concept Implementation
// Environment management for deployment targets. Resolves environment
// configurations, handles promotion pipelines, and computes diffs.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'env';

const _envHandler: FunctionalConceptHandler = {
  resolve(input: Record<string, unknown>) {
    const environment = input.environment as string;

    if (!environment || environment.trim() === '') {
      const p = createProgram();
      return complete(p, 'missingBase', { environment }) as StorageProgram<Result>;
    }

    const envId = `env-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const resolved = JSON.stringify({
      name: environment,
      region: 'us-east-1',
      tier: environment === 'production' ? 'production' : 'preview',
    });

    let p = createProgram();
    p = put(p, RELATION, envId, {
      environment: envId,
      name: environment,
      resolved,
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { environment: envId, resolved }) as StorageProgram<Result>;
  },

  promote(input: Record<string, unknown>) {
    const fromEnv = input.fromEnv as string;
    const toEnv = input.toEnv as string;
    const suiteName = input.suiteName as string;

    let p = createProgram();
    p = get(p, RELATION, fromEnv, 'fromRecord');

    return branch(p, 'fromRecord',
      (thenP) => {
        const version = '1.0.0';
        const toId = toEnv || `env-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        thenP = putFrom(thenP, RELATION, toId, (bindings) => {
          const fromRecord = bindings.fromRecord as Record<string, unknown>;
          return {
            environment: toId,
            name: toEnv,
            resolved: fromRecord.resolved,
            promotedFrom: fromEnv,
            promotedVersion: version,
            createdAt: new Date().toISOString(),
          };
        });

        return complete(thenP, 'ok', { toEnv: toId, version });
      },
      (elseP) => complete(elseP, 'notValidated', { fromEnv, suiteName }),
    ) as StorageProgram<Result>;
  },

  diff(input: Record<string, unknown>) {
    const envA = input.envA as string;
    const envB = input.envB as string;

    let p = createProgram();
    p = get(p, RELATION, envA, 'recordA');
    p = get(p, RELATION, envB, 'recordB');

    return completeFrom(p, 'ok', (bindings) => {
      const recordA = bindings.recordA as Record<string, unknown> | null;
      const recordB = bindings.recordB as Record<string, unknown> | null;

      const differences: string[] = [];
      if (recordA && recordB) {
        const resolvedA = recordA.resolved as string;
        const resolvedB = recordB.resolved as string;
        if (resolvedA !== resolvedB) {
          differences.push(`config differs between ${envA} and ${envB}`);
        }
      } else {
        if (!recordA) differences.push(`${envA} not found`);
        if (!recordB) differences.push(`${envB} not found`);
      }

      return { differences };
    }) as StorageProgram<Result>;
  },
};

export const envHandler = autoInterpret(_envHandler);
