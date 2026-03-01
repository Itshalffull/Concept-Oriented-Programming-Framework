// HandlerScaffoldGen — Handler implementation scaffold generator.
// Produces handler.ts and types.ts skeletons for a given concept, with
// one action method stub per declared action. Each stub is typed to return
// a TaskEither matching the concept's output variants.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  HandlerScaffoldGenStorage,
  HandlerScaffoldGenGenerateInput,
  HandlerScaffoldGenGenerateOutput,
  HandlerScaffoldGenPreviewInput,
  HandlerScaffoldGenPreviewOutput,
  HandlerScaffoldGenRegisterInput,
  HandlerScaffoldGenRegisterOutput,
} from './types.js';

import {
  generateOk,
  generateError,
  previewOk,
  previewCached,
  previewError,
  registerOk,
} from './types.js';

export interface HandlerScaffoldGenError {
  readonly code: string;
  readonly message: string;
}

export interface HandlerScaffoldGenHandler {
  readonly generate: (
    input: HandlerScaffoldGenGenerateInput,
    storage: HandlerScaffoldGenStorage,
  ) => TE.TaskEither<HandlerScaffoldGenError, HandlerScaffoldGenGenerateOutput>;
  readonly preview: (
    input: HandlerScaffoldGenPreviewInput,
    storage: HandlerScaffoldGenStorage,
  ) => TE.TaskEither<HandlerScaffoldGenError, HandlerScaffoldGenPreviewOutput>;
  readonly register: (
    input: HandlerScaffoldGenRegisterInput,
    storage: HandlerScaffoldGenStorage,
  ) => TE.TaskEither<HandlerScaffoldGenError, HandlerScaffoldGenRegisterOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): HandlerScaffoldGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Convert kebab-case to PascalCase. */
const toPascalCase = (name: string): string =>
  name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');

/** Convert kebab-case to camelCase. */
const toCamelCase = (name: string): string => {
  const pascal = toPascalCase(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

/** Extract the action name from an action descriptor. */
const actionName = (action: unknown): string => {
  if (typeof action === 'string') return action;
  if (typeof action === 'object' && action !== null && 'name' in action) {
    return String((action as Record<string, unknown>)['name']);
  }
  return 'unknown';
};

/** Build handler scaffold files for a concept with its actions. */
const buildHandlerFiles = (
  conceptName: string,
  actions: readonly unknown[],
): readonly Record<string, unknown>[] => {
  const pascal = toPascalCase(conceptName);
  const camel = toCamelCase(conceptName);
  const actionNames = actions.map(actionName);

  const typesContent = [
    `// ${pascal} — types.ts`,
    `// Type definitions for the ${pascal} concept handler.\n`,
    `export interface ${pascal}Storage {`,
    `  readonly get: (relation: string, key: string) => Promise<Record<string, unknown> | null>;`,
    `  readonly put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void>;`,
    `  readonly delete: (relation: string, key: string) => Promise<boolean>;`,
    `  readonly find: (relation: string, filter?: Record<string, unknown>) => Promise<readonly Record<string, unknown>[]>;`,
    `}\n`,
    ...actionNames.flatMap((a) => {
      const actionPascal = toPascalCase(a);
      return [
        `export interface ${pascal}${actionPascal}Input {`,
        `  // Define input fields for '${a}'`,
        `}\n`,
        `export interface ${pascal}${actionPascal}Output {`,
        `  readonly variant: 'ok';`,
        `  // Define output fields for '${a}'`,
        `}\n`,
      ];
    }),
  ].join('\n');

  const handlerContent = [
    `// ${pascal} — handler.ts`,
    `// Handler implementation for the ${pascal} concept.\n`,
    `import * as TE from 'fp-ts/TaskEither';`,
    `import { pipe } from 'fp-ts/function';\n`,
    `import type { ${pascal}Storage } from './types.js';\n`,
    `export interface ${pascal}Error {`,
    `  readonly code: string;`,
    `  readonly message: string;`,
    `}\n`,
    `export const ${camel}Handler = {`,
    ...actionNames.map(
      (a) =>
        `  ${toCamelCase(a)}: (input: unknown, storage: ${pascal}Storage): TE.TaskEither<${pascal}Error, unknown> =>\n    pipe(\n      TE.tryCatch(\n        async () => {\n          // TODO: implement ${a}\n          return { variant: 'ok' as const };\n        },\n        (error): ${pascal}Error => ({\n          code: 'NOT_IMPLEMENTED',\n          message: error instanceof Error ? error.message : String(error),\n        }),\n      ),\n    ),\n`,
    ),
    `};`,
  ].join('\n');

  return [
    { path: `${conceptName}/types.ts`, kind: 'types', content: typesContent },
    { path: `${conceptName}/handler.ts`, kind: 'handler', content: handlerContent },
    { path: `${conceptName}/index.ts`, kind: 'barrel', content: `export * from './types.js';\nexport * from './handler.js';` },
  ];
};

// --- Implementation ---

export const handlerScaffoldGenHandler: HandlerScaffoldGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { conceptName: name, actions } = input;

          if (name.trim().length === 0) {
            return generateError('Concept name must be non-empty');
          }

          if (actions.length === 0) {
            return generateError('At least one action must be specified');
          }

          const files = buildHandlerFiles(name, actions);

          await storage.put('scaffolds', name, {
            conceptName: name,
            actions: [...actions],
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
          const { conceptName: name, actions } = input;

          if (name.trim().length === 0) {
            return previewError('Concept name must be non-empty');
          }

          const existing = await storage.get('scaffolds', name);

          return pipe(
            O.fromNullable(existing),
            O.fold(
              () => {
                const files = buildHandlerFiles(name, actions);
                return previewOk(files, files.length, 0);
              },
              (cached) => {
                const cachedFiles = (cached['files'] as readonly unknown[]) ?? [];
                const newFiles = buildHandlerFiles(name, actions);

                const cachedPaths = new Set(
                  cachedFiles.map((f) => (f as Record<string, unknown>)['path'] as string),
                );
                const wouldWrite = newFiles.filter(
                  (f) => !cachedPaths.has((f as Record<string, unknown>)['path'] as string),
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
          'handler-scaffold-gen',
          'HandlerScaffoldGenGenerateInput',
          'HandlerScaffoldGenGenerateOutput',
          ['generate', 'preview', 'handler', 'types'],
        ),
      ),
    ),
};
