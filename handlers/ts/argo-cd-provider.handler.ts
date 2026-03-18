// @migrated dsl-constructs 2026-03-18
// ============================================================
// ArgoCDProvider Handler
//
// Generate ArgoCD Application CRDs from Clef deploy plans.
// Owns Application resources, sync wave ordering, health
// assessments, and auto-sync configuration.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `argo-cd-provider-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  emit(input: Record<string, unknown>) {
    const plan = input.plan as string;
    const repo = input.repo as string;
    const path = input.path as string;

    const appName = `clef-${plan}`;
    const namespace = 'default';
    const project = 'default';

    const applicationCrd = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: appName,
        namespace: 'argocd',
      },
      spec: {
        project,
        source: {
          repoURL: repo,
          targetRevision: 'HEAD',
          path,
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace,
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: true,
          },
        },
      },
    };

    const crdContent = JSON.stringify(applicationCrd, null, 2);
    const crdFileName = `${appName}-application.yaml`;

    const id = nextId();
    const now = new Date().toISOString();
    let p = createProgram();
    p = put(p, 'argo-cd-provider', id, {
      id,
      appName,
      project,
      repoUrl: repo,
      targetRevision: 'HEAD',
      path,
      namespace,
      syncStatus: 'OutOfSync',
      healthStatus: 'Missing',
      syncWave: null,
      lastSyncedAt: null,
      plan,
      crdContent,
      createdAt: now,
    });

    return complete(p, 'ok', {
      application: id,
      files: [crdFileName],
    }) as StorageProgram<Result>;
  },

  reconciliationStatus(input: Record<string, unknown>) {
    const application = input.application as string;

    let p = createProgram();
    p = get(p, 'argo-cd-provider', application, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = mapBindings(thenP, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const syncStatus = record.syncStatus as string;
          const healthStatus = record.healthStatus as string;

          if (syncStatus === 'Synced' && healthStatus === 'Healthy') {
            return {
              variant: 'ok',
              application,
              syncStatus,
              healthStatus,
              reconciledAt: record.lastSyncedAt || new Date().toISOString(),
            };
          }

          if (healthStatus === 'Degraded') {
            return {
              variant: 'degraded',
              application,
              unhealthyResources: [],
            };
          }

          if (syncStatus === 'OutOfSync' || syncStatus === 'Unknown') {
            return {
              variant: 'pending',
              application,
              waitingOn: ['sync'],
            };
          }

          return {
            variant: 'failed',
            application,
            reason: `Sync status: ${syncStatus}, Health: ${healthStatus}`,
          };
        }, 'result');

        return completeFrom(thenP, 'dynamic', (bindings) => {
          const result = bindings.result as Record<string, unknown>;
          return result;
        });
      },
      (elseP) => complete(elseP, 'failed', { application, reason: `Application '${application}' not found` }),
    ) as StorageProgram<Result>;
  },

  syncWave(input: Record<string, unknown>) {
    const application = input.application as string;
    const wave = input.wave as number;

    let p = createProgram();
    p = get(p, 'argo-cd-provider', application, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, 'argo-cd-provider', application, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, syncWave: wave };
        });
        return complete(thenP, 'ok', { application });
      },
      (elseP) => complete(elseP, 'ok', { application }),
    ) as StorageProgram<Result>;
  },
};

export const argoCDProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetArgoCDProviderCounter(): void {
  idCounter = 0;
}
