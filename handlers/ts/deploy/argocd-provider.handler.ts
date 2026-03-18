// @migrated dsl-constructs 2026-03-18
// ArgoCDProvider Concept Implementation
// ArgoCD GitOps provider. Generates ArgoCD Application CRDs, manages
// sync waves, and tracks reconciliation status.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'argocd';

const _argoCDProviderHandler: FunctionalConceptHandler = {
  emit(input: Record<string, unknown>) {
    const plan = input.plan as string;
    const repo = input.repo as string;
    const path = input.path as string;

    const applicationId = `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const files = ['application.yaml'];

    let p = createProgram();
    p = put(p, RELATION, applicationId, {
      application: applicationId,
      plan,
      repo,
      path,
      syncStatus: 'OutOfSync',
      healthStatus: 'Missing',
      status: 'emitted',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { application: applicationId, files }) as StorageProgram<Result>;
  },

  reconciliationStatus(input: Record<string, unknown>) {
    const application = input.application as string;

    let p = createProgram();
    p = get(p, RELATION, application, 'record');

    return branch(p, 'record',
      (thenP) => {
        const reconciledAt = new Date();
        thenP = putFrom(thenP, RELATION, application, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            syncStatus: 'Synced',
            healthStatus: 'Healthy',
            reconciledAt: reconciledAt.toISOString(),
          };
        });
        return complete(thenP, 'ok', {
          application,
          syncStatus: 'Synced',
          healthStatus: 'Healthy',
          reconciledAt,
        });
      },
      (elseP) => complete(elseP, 'failed', { application, reason: 'Application not found' }),
    ) as StorageProgram<Result>;
  },

  syncWave(input: Record<string, unknown>) {
    const application = input.application as string;
    const wave = input.wave as number;

    let p = createProgram();
    p = get(p, RELATION, application, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, RELATION, application, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, syncWave: wave };
        });
        return complete(thenP, 'ok', { application });
      },
      (elseP) => complete(elseP, 'ok', { application }),
    ) as StorageProgram<Result>;
  },
};

export const argoCDProviderHandler = autoInterpret(_argoCDProviderHandler);
