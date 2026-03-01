// CloudFormationProvider — AWS CloudFormation IaC provider: generates CFN
// templates from deploy plans, previews change sets, applies stacks, and
// tears down resources with rollback and partial-failure awareness.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  CloudFormationProviderStorage,
  CloudFormationProviderGenerateInput,
  CloudFormationProviderGenerateOutput,
  CloudFormationProviderPreviewInput,
  CloudFormationProviderPreviewOutput,
  CloudFormationProviderApplyInput,
  CloudFormationProviderApplyOutput,
  CloudFormationProviderTeardownInput,
  CloudFormationProviderTeardownOutput,
} from './types.js';

import {
  generateOk,
  previewOk,
  previewChangeSetEmpty,
  applyOk,
  applyRollbackComplete,
  applyPartial,
  applyInsufficientCapabilities,
  teardownOk,
  teardownDeletionFailed,
} from './types.js';

export interface CloudFormationProviderError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): CloudFormationProviderError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

export interface CloudFormationProviderHandler {
  readonly generate: (
    input: CloudFormationProviderGenerateInput,
    storage: CloudFormationProviderStorage,
  ) => TE.TaskEither<CloudFormationProviderError, CloudFormationProviderGenerateOutput>;
  readonly preview: (
    input: CloudFormationProviderPreviewInput,
    storage: CloudFormationProviderStorage,
  ) => TE.TaskEither<CloudFormationProviderError, CloudFormationProviderPreviewOutput>;
  readonly apply: (
    input: CloudFormationProviderApplyInput,
    storage: CloudFormationProviderStorage,
  ) => TE.TaskEither<CloudFormationProviderError, CloudFormationProviderApplyOutput>;
  readonly teardown: (
    input: CloudFormationProviderTeardownInput,
    storage: CloudFormationProviderStorage,
  ) => TE.TaskEither<CloudFormationProviderError, CloudFormationProviderTeardownOutput>;
}

// --- Implementation ---

export const cloudFormationProviderHandler: CloudFormationProviderHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const plan = JSON.parse(input.plan) as {
            readonly stackName?: string;
            readonly resources?: readonly Record<string, unknown>[];
          };
          const stackName = plan.stackName ?? `stack-${Date.now()}`;
          const resources = plan.resources ?? [];
          const templateFile = `${stackName}/template.yaml`;
          const paramFile = `${stackName}/parameters.json`;
          const files: readonly string[] = [templateFile, paramFile];
          await storage.put('cfn_stacks', stackName, {
            stackName,
            plan: input.plan,
            resources: resources.map((r) => String(r.type ?? 'AWS::Custom::Resource')),
            status: 'generated',
            generatedAt: new Date().toISOString(),
            files,
          });
          return generateOk(stackName, files);
        },
        mkError('GENERATE_FAILED'),
      ),
    ),

  preview: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('cfn_stacks', input.stack),
        mkError('STORAGE_READ'),
      ),
      TE.chain((stackRecord) =>
        pipe(
          O.fromNullable(stackRecord),
          O.fold(
            () => TE.right(previewChangeSetEmpty(input.stack)),
            (found) => {
              const resources = (found.resources ?? []) as readonly string[];
              const existingResources = (found.appliedResources ?? []) as readonly string[];
              const toCreate = resources.filter((r) => !existingResources.includes(r)).length;
              const toUpdate = resources.filter((r) => existingResources.includes(r)).length;
              const toDelete = existingResources.filter((r) => !resources.includes(r)).length;
              if (toCreate === 0 && toUpdate === 0 && toDelete === 0) {
                return TE.right(previewChangeSetEmpty(input.stack));
              }
              const changeSetId = `cs-${input.stack}-${Date.now()}`;
              return TE.right(previewOk(input.stack, changeSetId, toCreate, toUpdate, toDelete));
            },
          ),
        ),
      ),
    ),

  apply: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('cfn_stacks', input.stack),
        mkError('STORAGE_READ'),
      ),
      TE.chain((stackRecord) =>
        pipe(
          O.fromNullable(stackRecord),
          O.fold(
            () =>
              TE.right(
                applyRollbackComplete(input.stack, `Stack '${input.stack}' not found`),
              ),
            (found) => {
              const resources = (found.resources ?? []) as readonly string[];
              const requiredCapabilities = resources.some((r: string) =>
                r.includes('IAM') || r.includes('Custom'),
              )
                ? ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM']
                : [];
              const capabilities = (found.capabilities ?? []) as readonly string[];
              const missing = requiredCapabilities.filter(
                (c) => !capabilities.includes(c),
              );
              if (missing.length > 0) {
                return TE.right(
                  applyInsufficientCapabilities(input.stack, missing),
                );
              }
              const stackId = `arn:aws:cloudformation:us-east-1:123456789:stack/${input.stack}/${Date.now()}`;
              const existingResources = (found.appliedResources ?? []) as readonly string[];
              const created = resources.filter(
                (r) => !existingResources.includes(r),
              );
              const updated = resources.filter((r) =>
                existingResources.includes(r),
              );
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('cfn_stacks', input.stack, {
                      ...found,
                      status: 'applied',
                      stackId,
                      appliedResources: resources,
                      appliedAt: new Date().toISOString(),
                    });
                    return applyOk(input.stack, stackId, created, updated);
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
        () => storage.get('cfn_stacks', input.stack),
        mkError('STORAGE_READ'),
      ),
      TE.chain((stackRecord) =>
        pipe(
          O.fromNullable(stackRecord),
          O.fold(
            () =>
              TE.right(
                teardownDeletionFailed(input.stack, input.stack, `Stack '${input.stack}' not found`),
              ),
            (found) => {
              const appliedResources = (found.appliedResources ?? []) as readonly string[];
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.delete('cfn_stacks', input.stack);
                    return teardownOk(input.stack, appliedResources);
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
