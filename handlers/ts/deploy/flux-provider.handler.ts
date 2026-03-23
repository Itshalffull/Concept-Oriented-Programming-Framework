// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// FluxProvider Concept Implementation
// Flux GitOps provider. Generates Flux Kustomization CRDs, manages
// HelmRelease objects, and tracks reconciliation status.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'flux';

const _fluxProviderHandler: FunctionalConceptHandler = {
  emit(input: Record<string, unknown>) {
    if (!input.plan || (typeof input.plan === 'string' && (input.plan as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'plan is required' }) as StorageProgram<Result>;
    }
    const plan = input.plan as string;
    const repo = input.repo as string;
    const path = input.path as string;

    const kustomizationId = `ks-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const files = ['kustomization.yaml', 'source.yaml'];

    let p = createProgram();
    p = put(p, RELATION, kustomizationId, {
      kustomization: kustomizationId,
      plan,
      repo,
      path,
      readyStatus: 'False',
      status: 'emitted',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { kustomization: kustomizationId, files }) as StorageProgram<Result>;
  },

  reconciliationStatus(input: Record<string, unknown>) {
    if (!input.kustomization || (typeof input.kustomization === 'string' && (input.kustomization as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'kustomization is required' }) as StorageProgram<Result>;
    }
    const kustomization = input.kustomization as string;

    let p = createProgram();
    p = get(p, RELATION, kustomization, 'record');

    return branch(p, 'record',
      (thenP) => {
        const reconciledAt = new Date();
        const appliedRevision = `main@sha1:${Date.now().toString(16)}`;

        thenP = putFrom(thenP, RELATION, kustomization, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            readyStatus: 'True',
            lastAppliedRevision: appliedRevision,
            reconciledAt: reconciledAt.toISOString(),
          };
        });

        return complete(thenP, 'ok', {
          kustomization,
          readyStatus: 'True',
          appliedRevision,
          reconciledAt,
        });
      },
      (elseP) => complete(elseP, 'failed', { kustomization, reason: 'Kustomization not found' }),
    ) as StorageProgram<Result>;
  },

  helmRelease(input: Record<string, unknown>) {
    if (!input.chart || (typeof input.chart === 'string' && (input.chart as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'chart is required' }) as StorageProgram<Result>;
    }
    const kustomization = input.kustomization as string;
    const chart = input.chart as string;
    const values = input.values as string;

    const releaseName = `${chart}-release`;

    let p = createProgram();
    p = get(p, RELATION, kustomization, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = putFrom(thenP, RELATION, kustomization, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            releaseName,
            chart,
            values,
          };
        });
        return complete(thenP, 'ok', { kustomization, releaseName });
      },
      (elseP) => complete(elseP, 'ok', { kustomization, releaseName }),
    ) as StorageProgram<Result>;
  },
};

export const fluxProviderHandler = autoInterpret(_fluxProviderHandler);
