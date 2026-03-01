// DeployScaffoldGen — Deployment manifest scaffold generator.
// Produces deploy-plan files, runtime configuration stubs, and concept
// binding manifests for each declared runtime target. Supports preview
// with cached-diff detection and self-registration.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DeployScaffoldGenStorage,
  DeployScaffoldGenGenerateInput,
  DeployScaffoldGenGenerateOutput,
  DeployScaffoldGenPreviewInput,
  DeployScaffoldGenPreviewOutput,
  DeployScaffoldGenRegisterInput,
  DeployScaffoldGenRegisterOutput,
} from './types.js';

import {
  generateOk,
  generateError,
  previewOk,
  previewCached,
  previewError,
  registerOk,
} from './types.js';

export interface DeployScaffoldGenError {
  readonly code: string;
  readonly message: string;
}

export interface DeployScaffoldGenHandler {
  readonly generate: (
    input: DeployScaffoldGenGenerateInput,
    storage: DeployScaffoldGenStorage,
  ) => TE.TaskEither<DeployScaffoldGenError, DeployScaffoldGenGenerateOutput>;
  readonly preview: (
    input: DeployScaffoldGenPreviewInput,
    storage: DeployScaffoldGenStorage,
  ) => TE.TaskEither<DeployScaffoldGenError, DeployScaffoldGenPreviewOutput>;
  readonly register: (
    input: DeployScaffoldGenRegisterInput,
    storage: DeployScaffoldGenStorage,
  ) => TE.TaskEither<DeployScaffoldGenError, DeployScaffoldGenRegisterOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): DeployScaffoldGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Extract the name from a runtime descriptor (could be string or object). */
const runtimeName = (runtime: unknown): string => {
  if (typeof runtime === 'string') return runtime;
  if (typeof runtime === 'object' && runtime !== null && 'name' in runtime) {
    return String((runtime as Record<string, unknown>)['name']);
  }
  return 'unknown';
};

/** Extract the concept name from a concept descriptor. */
const conceptName = (concept: unknown): string => {
  if (typeof concept === 'string') return concept;
  if (typeof concept === 'object' && concept !== null && 'name' in concept) {
    return String((concept as Record<string, unknown>)['name']);
  }
  return 'unknown';
};

/** Build deploy scaffold file descriptors. */
const buildDeployFiles = (
  appName: string,
  runtimes: readonly unknown[],
  concepts: readonly unknown[],
): readonly Record<string, unknown>[] => {
  const files: Record<string, unknown>[] = [];

  // Top-level deploy plan
  files.push({
    path: `deploy/${appName}/deploy-plan.yaml`,
    kind: 'deploy-plan',
    content: `# Deploy plan for ${appName}\napp: ${appName}\nruntimes:\n${runtimes.map((r) => `  - ${runtimeName(r)}`).join('\n')}`,
  });

  // Per-runtime configuration
  for (const rt of runtimes) {
    const name = runtimeName(rt);
    files.push({
      path: `deploy/${appName}/runtimes/${name}.config.yaml`,
      kind: 'runtime-config',
      content: `# Runtime configuration: ${name}\nruntime: ${name}\nreplicas: 1`,
    });
  }

  // Per-concept binding manifest
  for (const c of concepts) {
    const name = conceptName(c);
    files.push({
      path: `deploy/${appName}/bindings/${name}.binding.yaml`,
      kind: 'concept-binding',
      content: `# Concept binding: ${name}\nconcept: ${name}\nruntime: ${runtimes.length > 0 ? runtimeName(runtimes[0]) : 'default'}`,
    });
  }

  // Index manifest
  files.push({
    path: `deploy/${appName}/index.yaml`,
    kind: 'index',
    content: `# Deployment index for ${appName}\nruntimes: ${runtimes.length}\nconcepts: ${concepts.length}`,
  });

  return files;
};

// --- Implementation ---

export const deployScaffoldGenHandler: DeployScaffoldGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { appName, runtimes, concepts } = input;

          if (appName.trim().length === 0) {
            return generateError('Application name must be non-empty');
          }

          const files = buildDeployFiles(appName, runtimes, concepts);

          await storage.put('scaffolds', appName, {
            appName,
            runtimes: [...runtimes],
            concepts: [...concepts],
            files,
            generatedAt: new Date().toISOString(),
          });

          return generateOk(files, files.length);
        },
        storageError,
      ),
    ),

  preview: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { appName, runtimes, concepts } = input;

          if (appName.trim().length === 0) {
            return previewError('Application name must be non-empty');
          }

          const existing = await storage.get('scaffolds', appName);

          return pipe(
            O.fromNullable(existing),
            O.fold(
              () => {
                const files = buildDeployFiles(appName, runtimes, concepts);
                return previewOk(files, files.length, 0);
              },
              (cached) => {
                const cachedFiles = (cached['files'] as readonly unknown[]) ?? [];
                const newFiles = buildDeployFiles(appName, runtimes, concepts);

                const cachedPaths = new Set(
                  cachedFiles.map((f) => (f as Record<string, unknown>)['path'] as string),
                );
                const wouldWrite = newFiles.filter(
                  (f) => !cachedPaths.has(f['path'] as string),
                ).length;
                const wouldSkip = newFiles.length - wouldWrite;

                return wouldWrite === 0
                  ? previewCached()
                  : previewOk(newFiles, wouldWrite, wouldSkip);
              },
            ),
          );
        },
        storageError,
      ),
    ),

  register: (_input, _storage) =>
    pipe(
      TE.right(
        registerOk(
          'deploy-scaffold-gen',
          'DeployScaffoldGenGenerateInput',
          'DeployScaffoldGenGenerateOutput',
          ['generate', 'preview', 'deploy-plan', 'runtime-config', 'concept-binding'],
        ),
      ),
    ),
};
