// TerraformProvider — Terraform IaC provider: generates HCL configurations
// from deploy plans, previews infrastructure changes with state lock awareness,
// applies plans with partial failure tracking, and tears down workspaces.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TerraformProviderStorage,
  TerraformProviderGenerateInput,
  TerraformProviderGenerateOutput,
  TerraformProviderPreviewInput,
  TerraformProviderPreviewOutput,
  TerraformProviderApplyInput,
  TerraformProviderApplyOutput,
  TerraformProviderTeardownInput,
  TerraformProviderTeardownOutput,
} from './types.js';

import {
  generateOk,
  previewOk,
  previewStateLocked,
  previewBackendInitRequired,
  applyOk,
  applyStateLocked,
  applyPartial,
  teardownOk,
} from './types.js';

export interface TerraformProviderError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): TerraformProviderError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

export interface TerraformProviderHandler {
  readonly generate: (
    input: TerraformProviderGenerateInput,
    storage: TerraformProviderStorage,
  ) => TE.TaskEither<TerraformProviderError, TerraformProviderGenerateOutput>;
  readonly preview: (
    input: TerraformProviderPreviewInput,
    storage: TerraformProviderStorage,
  ) => TE.TaskEither<TerraformProviderError, TerraformProviderPreviewOutput>;
  readonly apply: (
    input: TerraformProviderApplyInput,
    storage: TerraformProviderStorage,
  ) => TE.TaskEither<TerraformProviderError, TerraformProviderApplyOutput>;
  readonly teardown: (
    input: TerraformProviderTeardownInput,
    storage: TerraformProviderStorage,
  ) => TE.TaskEither<TerraformProviderError, TerraformProviderTeardownOutput>;
}

// --- Implementation ---

export const terraformProviderHandler: TerraformProviderHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const plan = JSON.parse(input.plan) as {
            readonly workspace?: string;
            readonly resources?: readonly Record<string, unknown>[];
            readonly providers?: readonly string[];
          };
          const workspace = plan.workspace ?? `ws-${Date.now()}`;
          const resources = plan.resources ?? [];
          const mainFile = `${workspace}/main.tf`;
          const varsFile = `${workspace}/variables.tf`;
          const providerFile = `${workspace}/providers.tf`;
          const files: readonly string[] = [mainFile, varsFile, providerFile];
          await storage.put('tf_workspaces', workspace, {
            workspace,
            plan: input.plan,
            resources: resources.map((r) => String(r.type ?? 'null_resource')),
            providers: plan.providers ?? ['hashicorp/null'],
            status: 'generated',
            backendInitialized: false,
            generatedAt: new Date().toISOString(),
            files,
          });
          return generateOk(workspace, files);
        },
        mkError('GENERATE_FAILED'),
      ),
    ),

  preview: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('tf_workspaces', input.workspace),
        mkError('STORAGE_READ'),
      ),
      TE.chain((wsRecord) =>
        pipe(
          O.fromNullable(wsRecord),
          O.fold(
            () => TE.right(previewBackendInitRequired(input.workspace)),
            (found) => {
              if (!found.backendInitialized) {
                return TE.right(previewBackendInitRequired(input.workspace));
              }
              if (found.lockId) {
                return TE.right(
                  previewStateLocked(
                    input.workspace,
                    String(found.lockId),
                    String(found.lockedBy ?? 'unknown'),
                  ),
                );
              }
              const resources = (found.resources ?? []) as readonly string[];
              const appliedResources = (found.appliedResources ?? []) as readonly string[];
              const toCreate = resources.filter((r) => !appliedResources.includes(r)).length;
              const toUpdate = resources.filter((r) => appliedResources.includes(r)).length;
              const toDelete = appliedResources.filter((r) => !resources.includes(r)).length;
              return TE.right(previewOk(input.workspace, toCreate, toUpdate, toDelete));
            },
          ),
        ),
      ),
    ),

  apply: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('tf_workspaces', input.workspace),
        mkError('STORAGE_READ'),
      ),
      TE.chain((wsRecord) =>
        pipe(
          O.fromNullable(wsRecord),
          O.fold(
            () =>
              TE.right(
                applyStateLocked(input.workspace, 'workspace-not-found'),
              ),
            (found) => {
              if (found.lockId) {
                return TE.right(
                  applyStateLocked(input.workspace, String(found.lockId)),
                );
              }
              const resources = (found.resources ?? []) as readonly string[];
              const appliedResources = (found.appliedResources ?? []) as readonly string[];
              const created = resources.filter((r) => !appliedResources.includes(r));
              const updated = resources.filter((r) => appliedResources.includes(r));
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('tf_workspaces', input.workspace, {
                      ...found,
                      status: 'applied',
                      appliedResources: resources,
                      appliedAt: new Date().toISOString(),
                    });
                    return applyOk(input.workspace, created, updated);
                  },
                  mkError('APPLY_FAILED'),
                ),
              );
            },
          ),
        ),
      ),
    ),

  teardown: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('tf_workspaces', input.workspace),
        mkError('STORAGE_READ'),
      ),
      TE.chain((wsRecord) =>
        pipe(
          O.fromNullable(wsRecord),
          O.fold(
            () => TE.right(teardownOk(input.workspace, [])),
            (found) => {
              const destroyed = (found.appliedResources ?? []) as readonly string[];
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.delete('tf_workspaces', input.workspace);
                    return teardownOk(input.workspace, destroyed);
                  },
                  mkError('TEARDOWN_FAILED'),
                ),
              );
            },
          ),
        ),
      ),
    ),
};
