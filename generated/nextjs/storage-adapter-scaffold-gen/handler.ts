// StorageAdapterScaffoldGen — Storage adapter scaffold generator.
// Produces adapter implementation stubs for a named storage backend
// (e.g. postgres, sqlite, dynamodb, memory). Each scaffold includes
// the standard get/put/delete/find operations typed to the backend.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  StorageAdapterScaffoldGenStorage,
  StorageAdapterScaffoldGenGenerateInput,
  StorageAdapterScaffoldGenGenerateOutput,
  StorageAdapterScaffoldGenPreviewInput,
  StorageAdapterScaffoldGenPreviewOutput,
  StorageAdapterScaffoldGenRegisterInput,
  StorageAdapterScaffoldGenRegisterOutput,
} from './types.js';

import {
  generateOk,
  generateError,
  previewOk,
  previewCached,
  previewError,
  registerOk,
} from './types.js';

export interface StorageAdapterScaffoldGenError {
  readonly code: string;
  readonly message: string;
}

export interface StorageAdapterScaffoldGenHandler {
  readonly generate: (
    input: StorageAdapterScaffoldGenGenerateInput,
    storage: StorageAdapterScaffoldGenStorage,
  ) => TE.TaskEither<StorageAdapterScaffoldGenError, StorageAdapterScaffoldGenGenerateOutput>;
  readonly preview: (
    input: StorageAdapterScaffoldGenPreviewInput,
    storage: StorageAdapterScaffoldGenStorage,
  ) => TE.TaskEither<StorageAdapterScaffoldGenError, StorageAdapterScaffoldGenPreviewOutput>;
  readonly register: (
    input: StorageAdapterScaffoldGenRegisterInput,
    storage: StorageAdapterScaffoldGenStorage,
  ) => TE.TaskEither<StorageAdapterScaffoldGenError, StorageAdapterScaffoldGenRegisterOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): StorageAdapterScaffoldGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Known storage backends and their driver packages. */
const BACKEND_DRIVERS: Readonly<Record<string, string>> = {
  postgres: 'pg',
  sqlite: 'better-sqlite3',
  mysql: 'mysql2',
  dynamodb: '@aws-sdk/client-dynamodb',
  firestore: '@google-cloud/firestore',
  memory: '(built-in)',
  redis: 'ioredis',
};

/** Convert a name to PascalCase. */
const toPascalCase = (name: string): string =>
  name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');

/** Build storage adapter scaffold files. */
const buildAdapterFiles = (
  name: string,
  backend: string,
): readonly Record<string, unknown>[] => {
  const pascal = toPascalCase(name);
  const driver = BACKEND_DRIVERS[backend] ?? backend;

  return [
    {
      path: `adapters/${name}/adapter.ts`,
      kind: 'adapter',
      content: [
        `// Storage adapter: ${pascal} (${backend})`,
        `// Driver: ${driver}\n`,
        `import type { ConceptStorage } from '../storage.js';\n`,
        `export const create${pascal}Adapter = (connectionString: string): ConceptStorage => ({`,
        `  get: async (relation, key) => {`,
        `    // TODO: implement ${backend} get`,
        `    return null;`,
        `  },`,
        `  put: async (relation, key, value) => {`,
        `    // TODO: implement ${backend} put`,
        `  },`,
        `  delete: async (relation, key) => {`,
        `    // TODO: implement ${backend} delete`,
        `    return false;`,
        `  },`,
        `  find: async (relation, filter) => {`,
        `    // TODO: implement ${backend} find`,
        `    return [];`,
        `  },`,
        `});`,
      ].join('\n'),
    },
    {
      path: `adapters/${name}/config.ts`,
      kind: 'config',
      content: [
        `// Configuration for ${pascal} storage adapter`,
        `export interface ${pascal}Config {`,
        `  readonly connectionString: string;`,
        `  readonly poolSize?: number;`,
        `  readonly timeout?: number;`,
        `}`,
      ].join('\n'),
    },
    {
      path: `adapters/${name}/index.ts`,
      kind: 'barrel',
      content: `export { create${pascal}Adapter } from './adapter.js';\nexport type { ${pascal}Config } from './config.js';`,
    },
  ];
};

// --- Implementation ---

export const storageAdapterScaffoldGenHandler: StorageAdapterScaffoldGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { name, backend } = input;

          if (name.trim().length === 0) {
            return generateError('Adapter name must be non-empty');
          }

          if (backend.trim().length === 0) {
            return generateError('Backend must be specified');
          }

          const files = buildAdapterFiles(name, backend);

          await storage.put('scaffolds', name, {
            name,
            backend,
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
          const { name, backend } = input;

          if (name.trim().length === 0) {
            return previewError('Adapter name must be non-empty');
          }

          const existing = await storage.get('scaffolds', name);

          return pipe(
            O.fromNullable(existing),
            O.fold(
              () => {
                const files = buildAdapterFiles(name, backend);
                return previewOk(files, files.length, 0);
              },
              (cached) => {
                const cachedFiles = (cached['files'] as readonly unknown[]) ?? [];
                const newFiles = buildAdapterFiles(name, backend);

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
          'storage-adapter-scaffold-gen',
          'StorageAdapterScaffoldGenGenerateInput',
          'StorageAdapterScaffoldGenGenerateOutput',
          ['generate', 'preview', 'adapter', 'config'],
        ),
      ),
    ),
};
