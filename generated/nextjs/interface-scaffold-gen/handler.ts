// InterfaceScaffoldGen — Interface manifest scaffold generator.
// Produces interface definition files that declare which targets (e.g. rest,
// graphql) and SDKs (e.g. typescript, python) a concept surface exposes.
// Each generated manifest binds targets to SDK output packages.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  InterfaceScaffoldGenStorage,
  InterfaceScaffoldGenGenerateInput,
  InterfaceScaffoldGenGenerateOutput,
  InterfaceScaffoldGenPreviewInput,
  InterfaceScaffoldGenPreviewOutput,
  InterfaceScaffoldGenRegisterInput,
  InterfaceScaffoldGenRegisterOutput,
} from './types.js';

import {
  generateOk,
  generateError,
  previewOk,
  previewCached,
  previewError,
  registerOk,
} from './types.js';

export interface InterfaceScaffoldGenError {
  readonly code: string;
  readonly message: string;
}

export interface InterfaceScaffoldGenHandler {
  readonly generate: (
    input: InterfaceScaffoldGenGenerateInput,
    storage: InterfaceScaffoldGenStorage,
  ) => TE.TaskEither<InterfaceScaffoldGenError, InterfaceScaffoldGenGenerateOutput>;
  readonly preview: (
    input: InterfaceScaffoldGenPreviewInput,
    storage: InterfaceScaffoldGenStorage,
  ) => TE.TaskEither<InterfaceScaffoldGenError, InterfaceScaffoldGenPreviewOutput>;
  readonly register: (
    input: InterfaceScaffoldGenRegisterInput,
    storage: InterfaceScaffoldGenStorage,
  ) => TE.TaskEither<InterfaceScaffoldGenError, InterfaceScaffoldGenRegisterOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): InterfaceScaffoldGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Build interface scaffold file descriptors. */
const buildInterfaceFiles = (
  name: string,
  targets: readonly string[],
  sdks: readonly string[],
): readonly Record<string, unknown>[] => {
  const files: Record<string, unknown>[] = [];

  // Main interface manifest
  files.push({
    path: `interfaces/${name}/interface.yaml`,
    kind: 'interface-manifest',
    content: [
      `# Interface manifest: ${name}`,
      `name: ${name}`,
      `targets:`,
      ...targets.map((t) => `  - ${t}`),
      `sdks:`,
      ...sdks.map((s) => `  - ${s}`),
    ].join('\n'),
  });

  // Per-target binding file
  for (const target of targets) {
    files.push({
      path: `interfaces/${name}/targets/${target}.binding.yaml`,
      kind: 'target-binding',
      content: `# Target binding: ${target} for ${name}\ntarget: ${target}\nactions: []`,
    });
  }

  // Per-SDK configuration file
  for (const sdk of sdks) {
    files.push({
      path: `interfaces/${name}/sdks/${sdk}.config.yaml`,
      kind: 'sdk-config',
      content: `# SDK config: ${sdk} for ${name}\nlanguage: ${sdk}\npackageName: "@clef-sdk/${name}-${sdk}"`,
    });
  }

  // Index barrel
  files.push({
    path: `interfaces/${name}/index.ts`,
    kind: 'barrel',
    content: `// Interface: ${name}\n// Targets: ${targets.join(', ')}\n// SDKs: ${sdks.join(', ')}`,
  });

  return files;
};

// --- Implementation ---

export const interfaceScaffoldGenHandler: InterfaceScaffoldGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { name, targets, sdks } = input;

          if (name.trim().length === 0) {
            return generateError('Interface name must be non-empty');
          }

          if (targets.length === 0) {
            return generateError('At least one target must be specified');
          }

          const files = buildInterfaceFiles(name, targets, sdks);

          await storage.put('scaffolds', name, {
            name,
            targets: [...targets],
            sdks: [...sdks],
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
          const { name, targets, sdks } = input;

          if (name.trim().length === 0) {
            return previewError('Interface name must be non-empty');
          }

          const existing = await storage.get('scaffolds', name);

          return pipe(
            O.fromNullable(existing),
            O.fold(
              () => {
                const files = buildInterfaceFiles(name, targets, sdks);
                return previewOk(files, files.length, 0);
              },
              (cached) => {
                const cachedFiles = (cached['files'] as readonly unknown[]) ?? [];
                const newFiles = buildInterfaceFiles(name, targets, sdks);

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
          'interface-scaffold-gen',
          'InterfaceScaffoldGenGenerateInput',
          'InterfaceScaffoldGenGenerateOutput',
          ['generate', 'preview', 'target-binding', 'sdk-config'],
        ),
      ),
    ),
};
