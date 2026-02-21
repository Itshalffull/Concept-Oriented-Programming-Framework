// GitOps Concept Implementation (Deploy Kit)
// Coordinate manifest generation for GitOps controllers.
import type { ConceptHandler } from '@copf/kernel';

export const gitopsHandler: ConceptHandler = {
  async emit(input, storage) {
    const plan = input.plan as string;
    const controller = input.controller as string;
    const repo = input.repo as string;
    const path = input.path as string;

    const supportedControllers = ['argocd', 'flux', 'jenkins'];
    if (!supportedControllers.includes(controller)) {
      return { variant: 'controllerUnsupported', controller };
    }

    const manifestId = `gm-${Date.now()}`;
    const committedAt = new Date().toISOString();

    // Generate file list based on controller type
    const files: string[] = [];
    if (controller === 'argocd') {
      files.push(`${path}/application.yaml`, `${path}/kustomization.yaml`, `${path}/values.yaml`);
    } else if (controller === 'flux') {
      files.push(`${path}/gitrepository.yaml`, `${path}/kustomization.yaml`, `${path}/helmrelease.yaml`);
    } else {
      files.push(`${path}/deployment.yaml`, `${path}/service.yaml`);
    }

    await storage.put('manifest', manifestId, {
      manifestId,
      plan,
      controller,
      repoPath: repo,
      path,
      committedAt,
      reconciledAt: null,
      status: 'committed',
      files: JSON.stringify(files),
    });

    return { variant: 'ok', manifest: manifestId, files: JSON.stringify(files) };
  },

  async reconciliationStatus(input, storage) {
    const manifest = input.manifest as string;

    const existing = await storage.get('manifest', manifest);
    if (!existing) {
      return { variant: 'failed', manifest, reason: 'Manifest not found' };
    }

    const status = existing.status as string;

    if (status === 'reconciled') {
      return {
        variant: 'ok',
        manifest,
        status: 'synced',
        reconciledAt: existing.reconciledAt as string,
      };
    }

    if (status === 'failed') {
      return {
        variant: 'failed',
        manifest,
        reason: (existing.failureReason as string) || 'Reconciliation failed',
      };
    }

    // Status is committed or pending
    const files: string[] = JSON.parse(existing.files as string);
    return {
      variant: 'pending',
      manifest,
      waitingOn: JSON.stringify(files),
    };
  },
};
