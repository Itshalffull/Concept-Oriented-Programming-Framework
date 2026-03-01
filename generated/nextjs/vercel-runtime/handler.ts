// VercelRuntime — Serverless function deployment, edge middleware, and environment config
// Manages Vercel project lifecycle: provisioning projects with domain conflict detection,
// deploying from source directories, traffic weight shifting, and instant rollbacks.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  VercelRuntimeStorage,
  VercelRuntimeProvisionInput,
  VercelRuntimeProvisionOutput,
  VercelRuntimeDeployInput,
  VercelRuntimeDeployOutput,
  VercelRuntimeSetTrafficWeightInput,
  VercelRuntimeSetTrafficWeightOutput,
  VercelRuntimeRollbackInput,
  VercelRuntimeRollbackOutput,
  VercelRuntimeDestroyInput,
  VercelRuntimeDestroyOutput,
} from './types.js';

import {
  provisionOk,
  provisionDomainConflict,
  deployOk,
  deployBuildFailed,
  setTrafficWeightOk,
  rollbackOk,
  destroyOk,
} from './types.js';

export interface VercelRuntimeError {
  readonly code: string;
  readonly message: string;
}

export interface VercelRuntimeHandler {
  readonly provision: (
    input: VercelRuntimeProvisionInput,
    storage: VercelRuntimeStorage,
  ) => TE.TaskEither<VercelRuntimeError, VercelRuntimeProvisionOutput>;
  readonly deploy: (
    input: VercelRuntimeDeployInput,
    storage: VercelRuntimeStorage,
  ) => TE.TaskEither<VercelRuntimeError, VercelRuntimeDeployOutput>;
  readonly setTrafficWeight: (
    input: VercelRuntimeSetTrafficWeightInput,
    storage: VercelRuntimeStorage,
  ) => TE.TaskEither<VercelRuntimeError, VercelRuntimeSetTrafficWeightOutput>;
  readonly rollback: (
    input: VercelRuntimeRollbackInput,
    storage: VercelRuntimeStorage,
  ) => TE.TaskEither<VercelRuntimeError, VercelRuntimeRollbackOutput>;
  readonly destroy: (
    input: VercelRuntimeDestroyInput,
    storage: VercelRuntimeStorage,
  ) => TE.TaskEither<VercelRuntimeError, VercelRuntimeDestroyOutput>;
}

const toError = (error: unknown): VercelRuntimeError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const vercelRuntimeHandler: VercelRuntimeHandler = {
  provision: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('domains', { concept: input.concept }),
        toError,
      ),
      TE.chain((existingDomains) => {
        // Check for domain conflicts with existing projects
        const domain = `${input.concept}.vercel.app`;
        const conflict = existingDomains.find(
          (d) => String((d as Record<string, unknown>).domain) === domain,
        );

        if (conflict) {
          return TE.right<VercelRuntimeError, VercelRuntimeProvisionOutput>(
            provisionDomainConflict(
              domain,
              String((conflict as Record<string, unknown>).project),
            ),
          );
        }

        const projectName = `prj-${input.concept}`;
        const projectId = `prj_${input.concept}_${input.teamId}`;
        const endpoint = `https://${domain}`;

        return TE.tryCatch(
          async () => {
            await storage.put('projects', projectName, {
              project: projectName,
              projectId,
              concept: input.concept,
              teamId: input.teamId,
              framework: input.framework,
              endpoint,
              deploymentCount: 0,
              weight: 100,
              createdAt: new Date().toISOString(),
            });
            await storage.put('domains', domain, {
              domain,
              project: projectName,
              concept: input.concept,
            });
            return provisionOk(projectName, projectId, endpoint);
          },
          toError,
        );
      }),
    ),

  deploy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('projects', input.project),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<VercelRuntimeError, VercelRuntimeDeployOutput>({
              code: 'PROJECT_NOT_FOUND',
              message: `Project ${input.project} does not exist`,
            }),
            (existing) => {
              // Validate the source directory is not empty
              if (!input.sourceDirectory || input.sourceDirectory.trim().length === 0) {
                return TE.right<VercelRuntimeError, VercelRuntimeDeployOutput>(
                  deployBuildFailed(input.project, ['Source directory is empty']),
                );
              }

              const deploymentCount = Number((existing as Record<string, unknown>).deploymentCount ?? 0);
              const deploymentId = `dpl_${input.project}_${deploymentCount + 1}`;
              const deploymentUrl = `https://${input.project}-${deploymentId}.vercel.app`;

              return TE.tryCatch(
                async () => {
                  await storage.put('deployments', `${input.project}:${deploymentId}`, {
                    project: input.project,
                    deploymentId,
                    deploymentUrl,
                    sourceDirectory: input.sourceDirectory,
                    deployedAt: new Date().toISOString(),
                  });
                  await storage.put('projects', input.project, {
                    ...existing,
                    deploymentCount: deploymentCount + 1,
                    activeDeploymentId: deploymentId,
                    activeDeploymentUrl: deploymentUrl,
                  });
                  return deployOk(input.project, deploymentId, deploymentUrl);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  setTrafficWeight: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('projects', input.project),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<VercelRuntimeError, VercelRuntimeSetTrafficWeightOutput>({
              code: 'PROJECT_NOT_FOUND',
              message: `Project ${input.project} does not exist`,
            }),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const clampedWeight = Math.max(0, Math.min(100, input.weight));
                  await storage.put('projects', input.project, {
                    ...existing,
                    weight: clampedWeight,
                  });
                  return setTrafficWeightOk(input.project);
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  rollback: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('deployments', `${input.project}:${input.targetDeploymentId}`),
        toError,
      ),
      TE.chain((deployRecord) =>
        pipe(
          O.fromNullable(deployRecord),
          O.fold(
            () => TE.left<VercelRuntimeError, VercelRuntimeRollbackOutput>({
              code: 'DEPLOYMENT_NOT_FOUND',
              message: `Deployment ${input.targetDeploymentId} not found for ${input.project}`,
            }),
            (depData) =>
              TE.tryCatch(
                async () => {
                  const projectRecord = await storage.get('projects', input.project);
                  if (projectRecord) {
                    await storage.put('projects', input.project, {
                      ...projectRecord,
                      activeDeploymentId: input.targetDeploymentId,
                      activeDeploymentUrl: (depData as Record<string, unknown>).deploymentUrl,
                    });
                  }
                  return rollbackOk(input.project, input.targetDeploymentId);
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  destroy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('projects', input.project),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<VercelRuntimeError, VercelRuntimeDestroyOutput>({
              code: 'PROJECT_NOT_FOUND',
              message: `Project ${input.project} does not exist`,
            }),
            () =>
              TE.tryCatch(
                async () => {
                  // Remove all deployments for this project
                  const deployments = await storage.find('deployments', { project: input.project });
                  for (const dep of deployments) {
                    const depId = String((dep as Record<string, unknown>).deploymentId ?? '');
                    await storage.delete('deployments', `${input.project}:${depId}`);
                  }
                  // Remove domain bindings
                  const domains = await storage.find('domains', { project: input.project });
                  for (const d of domains) {
                    await storage.delete('domains', String((d as Record<string, unknown>).domain ?? ''));
                  }
                  await storage.delete('projects', input.project);
                  return destroyOk(input.project);
                },
                toError,
              ),
          ),
        ),
      ),
    ),
};
