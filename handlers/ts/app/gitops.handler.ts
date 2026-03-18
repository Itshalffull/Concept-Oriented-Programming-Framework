// @migrated dsl-constructs 2026-03-18
// GitOps Concept Implementation (Deploy Kit)
// Coordinate manifest generation for GitOps controllers.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const gitopsHandler: FunctionalConceptHandler = {
  emit(input: Record<string, unknown>) {
    const plan = input.plan as string;
    const controller = input.controller as string;
    const repo = input.repo as string;
    const path = input.path as string;

    const supportedControllers = ['argocd', 'flux', 'jenkins'];
    if (!supportedControllers.includes(controller)) {
      const p = createProgram();
      return complete(p, 'controllerUnsupported', { controller }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
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

    let p = createProgram();
    p = put(p, 'manifest', manifestId, {
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

    return complete(p, 'ok', { manifest: manifestId, files: JSON.stringify(files) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  reconciliationStatus(input: Record<string, unknown>) {
    const manifest = input.manifest as string;

    let p = createProgram();
    p = spGet(p, 'manifest', manifest, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', {
        manifest,
        status: 'synced',
        reconciledAt: new Date().toISOString(),
      }),
      (b) => complete(b, 'failed', { manifest, reason: 'Manifest not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
