// PulumiProvider — Pulumi IaC provider: generates Pulumi programs from deploy
// plans, previews changes with cost estimation and backend connectivity checks,
// applies stacks with plugin dependency and conflict awareness, and tears down
// with protected resource detection.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  PulumiProviderStorage,
  PulumiProviderGenerateInput,
  PulumiProviderGenerateOutput,
  PulumiProviderPreviewInput,
  PulumiProviderPreviewOutput,
  PulumiProviderApplyInput,
  PulumiProviderApplyOutput,
  PulumiProviderTeardownInput,
  PulumiProviderTeardownOutput,
} from './types.js';

import {
  generateOk,
  previewOk,
  previewBackendUnreachable,
  applyOk,
  applyPluginMissing,
  applyConflictingUpdate,
  applyPartial,
  teardownOk,
  teardownProtectedResource,
} from './types.js';

export interface PulumiProviderError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): PulumiProviderError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

export interface PulumiProviderHandler {
  readonly generate: (
    input: PulumiProviderGenerateInput,
    storage: PulumiProviderStorage,
  ) => TE.TaskEither<PulumiProviderError, PulumiProviderGenerateOutput>;
  readonly preview: (
    input: PulumiProviderPreviewInput,
    storage: PulumiProviderStorage,
  ) => TE.TaskEither<PulumiProviderError, PulumiProviderPreviewOutput>;
  readonly apply: (
    input: PulumiProviderApplyInput,
    storage: PulumiProviderStorage,
  ) => TE.TaskEither<PulumiProviderError, PulumiProviderApplyOutput>;
  readonly teardown: (
    input: PulumiProviderTeardownInput,
    storage: PulumiProviderStorage,
  ) => TE.TaskEither<PulumiProviderError, PulumiProviderTeardownOutput>;
}

// --- Implementation ---

const estimateResourceCost = (resourceType: string): number => {
  const costMap: Record<string, number> = {
    'aws:ec2:Instance': 50, 'aws:rds:Instance': 100, 'aws:s3:Bucket': 5,
    'aws:lambda:Function': 10, 'gcp:compute:Instance': 55,
  };
  return costMap[resourceType] ?? 1;
};

export const pulumiProviderHandler: PulumiProviderHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const plan = JSON.parse(input.plan) as {
            readonly stack?: string;
            readonly resources?: readonly Record<string, unknown>[];
            readonly plugins?: readonly { readonly name: string; readonly version: string }[];
          };
          const stack = plan.stack ?? `pulumi-stack-${Date.now()}`;
          const resources = plan.resources ?? [];
          const indexFile = `${stack}/index.ts`;
          const pulumiYaml = `${stack}/Pulumi.yaml`;
          const stackConfig = `${stack}/Pulumi.${stack}.yaml`;
          const files: readonly string[] = [indexFile, pulumiYaml, stackConfig];
          await storage.put('pulumi_stacks', stack, {
            stack,
            plan: input.plan,
            resources: resources.map((r) => String(r.type ?? 'pulumi:pulumi:StackReference')),
            plugins: plan.plugins ?? [],
            protectedResources: resources.filter((r) => r.protect).map((r) => String(r.type)),
            backendUrl: 'https://app.pulumi.com',
            status: 'generated',
            generatedAt: new Date().toISOString(),
            files,
          });
          return generateOk(stack, files);
        },
        mkError('GENERATE_FAILED'),
      ),
    ),

  preview: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('pulumi_stacks', input.stack),
        mkError('STORAGE_READ'),
      ),
      TE.chain((stackRecord) =>
        pipe(
          O.fromNullable(stackRecord),
          O.fold(
            () => TE.right(previewBackendUnreachable('https://app.pulumi.com')),
            (found) => {
              if (found.backendUnreachable) {
                return TE.right(
                  previewBackendUnreachable(String(found.backendUrl)),
                );
              }
              const resources = (found.resources ?? []) as readonly string[];
              const appliedResources = (found.appliedResources ?? []) as readonly string[];
              const toCreate = resources.filter((r) => !appliedResources.includes(r)).length;
              const toUpdate = resources.filter((r) => appliedResources.includes(r)).length;
              const toDelete = appliedResources.filter((r) => !resources.includes(r)).length;
              const estimatedCost = resources.reduce(
                (sum, r) => sum + estimateResourceCost(r),
                0,
              );
              return TE.right(
                previewOk(input.stack, toCreate, toUpdate, toDelete, estimatedCost),
              );
            },
          ),
        ),
      ),
    ),

  apply: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('pulumi_stacks', input.stack),
        mkError('STORAGE_READ'),
      ),
      TE.chain((stackRecord) =>
        pipe(
          O.fromNullable(stackRecord),
          O.fold(
            () =>
              TE.right(
                applyPluginMissing('pulumi', 'unknown'),
              ),
            (found) => {
              const plugins = (found.plugins ?? []) as readonly { readonly name: string; readonly version: string }[];
              const missingPlugin = plugins.find((p) => p.version === 'missing');
              if (missingPlugin) {
                return TE.right(
                  applyPluginMissing(missingPlugin.name, missingPlugin.version),
                );
              }
              const pendingOps = (found.pendingOps ?? []) as readonly string[];
              if (pendingOps.length > 0) {
                return TE.right(
                  applyConflictingUpdate(input.stack, pendingOps),
                );
              }
              const resources = (found.resources ?? []) as readonly string[];
              const appliedResources = (found.appliedResources ?? []) as readonly string[];
              const created = resources.filter((r) => !appliedResources.includes(r));
              const updated = resources.filter((r) => appliedResources.includes(r));
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('pulumi_stacks', input.stack, {
                      ...found,
                      status: 'applied',
                      appliedResources: resources,
                      appliedAt: new Date().toISOString(),
                    });
                    return applyOk(input.stack, created, updated);
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
        () => storage.get('pulumi_stacks', input.stack),
        mkError('STORAGE_READ'),
      ),
      TE.chain((stackRecord) =>
        pipe(
          O.fromNullable(stackRecord),
          O.fold(
            () => TE.right(teardownOk(input.stack, [])),
            (found) => {
              const protectedResources = (found.protectedResources ?? []) as readonly string[];
              if (protectedResources.length > 0) {
                return TE.right(
                  teardownProtectedResource(input.stack, protectedResources[0]),
                );
              }
              const destroyed = (found.appliedResources ?? []) as readonly string[];
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.delete('pulumi_stacks', input.stack);
                    return teardownOk(input.stack, destroyed);
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
