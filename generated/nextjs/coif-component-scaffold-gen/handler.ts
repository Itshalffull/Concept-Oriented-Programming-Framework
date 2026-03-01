// CoifComponentScaffoldGen — Surface component scaffold generator.
// Produces widget, anatomy-part, and state-machine scaffold files for
// a named component. Generates concept spec stubs, handler skeletons,
// and type definitions based on the declared parts, states, and events.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  CoifComponentScaffoldGenStorage,
  CoifComponentScaffoldGenGenerateInput,
  CoifComponentScaffoldGenGenerateOutput,
  CoifComponentScaffoldGenPreviewInput,
  CoifComponentScaffoldGenPreviewOutput,
  CoifComponentScaffoldGenRegisterInput,
  CoifComponentScaffoldGenRegisterOutput,
} from './types.js';

import {
  generateOk,
  generateError,
  previewOk,
  previewCached,
  previewError,
  registerOk,
} from './types.js';

export interface CoifComponentScaffoldGenError {
  readonly code: string;
  readonly message: string;
}

export interface CoifComponentScaffoldGenHandler {
  readonly generate: (
    input: CoifComponentScaffoldGenGenerateInput,
    storage: CoifComponentScaffoldGenStorage,
  ) => TE.TaskEither<CoifComponentScaffoldGenError, CoifComponentScaffoldGenGenerateOutput>;
  readonly preview: (
    input: CoifComponentScaffoldGenPreviewInput,
    storage: CoifComponentScaffoldGenStorage,
  ) => TE.TaskEither<CoifComponentScaffoldGenError, CoifComponentScaffoldGenPreviewOutput>;
  readonly register: (
    input: CoifComponentScaffoldGenRegisterInput,
    storage: CoifComponentScaffoldGenStorage,
  ) => TE.TaskEither<CoifComponentScaffoldGenError, CoifComponentScaffoldGenRegisterOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): CoifComponentScaffoldGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Convert a component name to PascalCase for type identifiers. */
const toPascalCase = (name: string): string =>
  name
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');

/** Build the scaffold file descriptors for a Surface component. */
const buildComponentFiles = (
  name: string,
  parts: readonly string[],
  states: readonly string[],
  events: readonly string[],
): readonly Record<string, unknown>[] => {
  const pascal = toPascalCase(name);
  const files: Record<string, unknown>[] = [];

  // Widget concept spec
  files.push({
    path: `${name}/${name}.concept`,
    kind: 'concept-spec',
    content: `concept ${pascal} {\n  // Widget definition\n}`,
  });

  // Anatomy parts
  for (const part of parts) {
    files.push({
      path: `${name}/parts/${part}.concept`,
      kind: 'anatomy-part',
      content: `part ${part} of ${pascal} {\n  // Anatomy part scaffold\n}`,
    });
  }

  // State machine
  if (states.length > 0) {
    files.push({
      path: `${name}/${name}.machine.ts`,
      kind: 'state-machine',
      content: `// State machine for ${pascal}\n// States: ${states.join(', ')}`,
    });
  }

  // Event handlers
  for (const event of events) {
    files.push({
      path: `${name}/events/${event}.handler.ts`,
      kind: 'event-handler',
      content: `// Event handler: ${event} for ${pascal}`,
    });
  }

  // Types file
  files.push({
    path: `${name}/types.ts`,
    kind: 'types',
    content: `// Type definitions for ${pascal}`,
  });

  // Index barrel export
  files.push({
    path: `${name}/index.ts`,
    kind: 'barrel',
    content: `export * from './types.js';`,
  });

  return files;
};

// --- Implementation ---

export const coifComponentScaffoldGenHandler: CoifComponentScaffoldGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { name, parts, states, events } = input;

          // Validate name is non-empty
          if (name.trim().length === 0) {
            return generateError('Component name must be non-empty');
          }

          const files = buildComponentFiles(name, parts, states, events);

          // Persist the scaffold record
          await storage.put('scaffolds', name, {
            name,
            parts: [...parts],
            states: [...states],
            events: [...events],
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
          const { name, parts, states, events } = input;

          if (name.trim().length === 0) {
            return previewError('Component name must be non-empty');
          }

          // Check if a scaffold was already generated for this component
          const existing = await storage.get('scaffolds', name);

          return pipe(
            O.fromNullable(existing),
            O.fold(
              () => {
                // No cached version: compute what would be generated
                const files = buildComponentFiles(name, parts, states, events);
                return previewOk(files, files.length, 0);
              },
              (cached) => {
                const cachedFiles = (cached['files'] as readonly unknown[]) ?? [];
                const newFiles = buildComponentFiles(name, parts, states, events);

                // Determine which files are new vs already exist
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
          'coif-component-scaffold-gen',
          'CoifComponentScaffoldGenGenerateInput',
          'CoifComponentScaffoldGenGenerateOutput',
          ['generate', 'preview', 'widget', 'anatomy', 'state-machine'],
        ),
      ),
    ),
};
