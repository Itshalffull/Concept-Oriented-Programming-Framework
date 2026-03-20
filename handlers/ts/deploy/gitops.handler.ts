// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// GitOps Concept Implementation
// GitOps manifest generation and reconciliation tracking. Emits
// controller-specific manifests (ArgoCD, Flux) and monitors sync status.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'gitops';
const SUPPORTED_CONTROLLERS = ['argocd', 'flux'];

const _gitopsHandler: FunctionalConceptHandler = {
  emit(input: Record<string, unknown>) {
    const plan = input.plan as string;
    const controller = input.controller as string;
    const repo = input.repo as string;
    const path = input.path as string;

    if (!SUPPORTED_CONTROLLERS.includes(controller)) {
      const p = createProgram();
      return complete(p, 'controllerUnsupported', { controller }) as StorageProgram<Result>;
    }

    const manifestId = `go-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const files = [
      `${path}/${controller}-application.yaml`,
      `${path}/${controller}-project.yaml`,
    ];

    let p = createProgram();
    p = put(p, RELATION, manifestId, {
      manifest: manifestId,
      plan,
      controller,
      repo,
      path,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { manifest: manifestId, files }) as StorageProgram<Result>;
  },

  reconciliationStatus(input: Record<string, unknown>) {
    const manifest = input.manifest as string;

    let p = createProgram();
    p = get(p, RELATION, manifest, 'record');

    return branch(p, 'record',
      (thenP) => complete(thenP, 'ok', {
        manifest,
        status: 'synced',
        reconciledAt: new Date().toISOString(),
      }),
      (elseP) => complete(elseP, 'failed', { manifest, reason: 'Manifest not found' }),
    ) as StorageProgram<Result>;
  },
};

export const gitopsHandler = autoInterpret(_gitopsHandler);
