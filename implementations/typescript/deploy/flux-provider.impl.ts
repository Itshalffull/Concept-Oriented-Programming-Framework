// FluxProvider Concept Implementation
// Flux GitOps provider. Generates Flux Kustomization CRDs, manages
// HelmRelease objects, and tracks reconciliation status.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'flux';

export const fluxProviderHandler: ConceptHandler = {
  async emit(input, storage) {
    const plan = input.plan as string;
    const repo = input.repo as string;
    const path = input.path as string;

    const kustomizationId = `ks-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const files = ['kustomization.yaml', 'source.yaml'];

    await storage.put(RELATION, kustomizationId, {
      kustomization: kustomizationId,
      plan,
      repo,
      path,
      files: JSON.stringify(files),
      readyStatus: 'False',
      status: 'emitted',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', kustomization: kustomizationId, files };
  },

  async reconciliationStatus(input, storage) {
    const kustomization = input.kustomization as string;

    const record = await storage.get(RELATION, kustomization);
    if (!record) {
      return { variant: 'failed', kustomization, reason: 'Kustomization not found' };
    }

    const reconciledAt = new Date();
    const appliedRevision = `main@sha1:${Date.now().toString(16)}`;

    await storage.put(RELATION, kustomization, {
      ...record,
      readyStatus: 'True',
      lastAppliedRevision: appliedRevision,
      reconciledAt: reconciledAt.toISOString(),
    });

    return {
      variant: 'ok',
      kustomization,
      readyStatus: 'True',
      appliedRevision,
      reconciledAt,
    };
  },

  async helmRelease(input, storage) {
    const kustomization = input.kustomization as string;
    const chart = input.chart as string;
    const values = input.values as string;

    const releaseName = `${chart}-release`;

    const record = await storage.get(RELATION, kustomization);
    if (record) {
      await storage.put(RELATION, kustomization, {
        ...record,
        releaseName,
        chart,
        values,
      });
    }

    return { variant: 'ok', kustomization, releaseName };
  },
};
