// KitScaffoldGen — Suite manifest scaffold generator.
// Produces a suite.yaml manifest and per-concept stub files for a named
// suite (kit). Each concept gets a minimal .concept spec file, and the
// suite.yaml aggregates the full concept list with metadata.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  KitScaffoldGenStorage,
  KitScaffoldGenGenerateInput,
  KitScaffoldGenGenerateOutput,
  KitScaffoldGenPreviewInput,
  KitScaffoldGenPreviewOutput,
  KitScaffoldGenRegisterInput,
  KitScaffoldGenRegisterOutput,
} from './types.js';

import {
  generateOk,
  generateError,
  previewOk,
  previewCached,
  previewError,
  registerOk,
} from './types.js';

export interface KitScaffoldGenError {
  readonly code: string;
  readonly message: string;
}

export interface KitScaffoldGenHandler {
  readonly generate: (
    input: KitScaffoldGenGenerateInput,
    storage: KitScaffoldGenStorage,
  ) => TE.TaskEither<KitScaffoldGenError, KitScaffoldGenGenerateOutput>;
  readonly preview: (
    input: KitScaffoldGenPreviewInput,
    storage: KitScaffoldGenStorage,
  ) => TE.TaskEither<KitScaffoldGenError, KitScaffoldGenPreviewOutput>;
  readonly register: (
    input: KitScaffoldGenRegisterInput,
    storage: KitScaffoldGenStorage,
  ) => TE.TaskEither<KitScaffoldGenError, KitScaffoldGenRegisterOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): KitScaffoldGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Build suite scaffold files from the input parameters. */
const buildSuiteFiles = (
  name: string,
  description: string,
  concepts: readonly string[],
): readonly Record<string, unknown>[] => {
  const files: Record<string, unknown>[] = [];

  // suite.yaml manifest
  files.push({
    path: `${name}/suite.yaml`,
    kind: 'suite-manifest',
    content: [
      `# Suite manifest: ${name}`,
      `name: ${name}`,
      `description: "${description}"`,
      `concepts:`,
      ...concepts.map((c) => `  - ${c}`),
    ].join('\n'),
  });

  // Per-concept stub files
  for (const concept of concepts) {
    files.push({
      path: `${name}/${concept}/${concept}.concept`,
      kind: 'concept-spec',
      content: `concept ${concept} {\n  // TODO: define actions and state for ${concept}\n}`,
    });
  }

  // Suite index
  files.push({
    path: `${name}/index.ts`,
    kind: 'barrel',
    content: concepts
      .map((c) => `export * from './${c}/index.js';`)
      .join('\n'),
  });

  return files;
};

// --- Implementation ---

export const kitScaffoldGenHandler: KitScaffoldGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { name, description, concepts } = input;

          if (name.trim().length === 0) {
            return generateError('Suite name must be non-empty');
          }

          if (concepts.length === 0) {
            return generateError('At least one concept must be specified');
          }

          const files = buildSuiteFiles(name, description, concepts);

          await storage.put('scaffolds', name, {
            name,
            description,
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
          const { name, description, concepts } = input;

          if (name.trim().length === 0) {
            return previewError('Suite name must be non-empty');
          }

          const existing = await storage.get('scaffolds', name);

          return pipe(
            O.fromNullable(existing),
            O.fold(
              () => {
                const files = buildSuiteFiles(name, description, concepts);
                return previewOk(files, files.length, 0);
              },
              (cached) => {
                const cachedFiles = (cached['files'] as readonly unknown[]) ?? [];
                const newFiles = buildSuiteFiles(name, description, concepts);

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
          'kit-scaffold-gen',
          'KitScaffoldGenGenerateInput',
          'KitScaffoldGenGenerateOutput',
          ['generate', 'preview', 'suite-manifest', 'concept-spec'],
        ),
      ),
    ),
};
