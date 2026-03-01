// SyncScaffoldGen — Sync rule scaffold generator.
// Produces sync rule definition files that declare a trigger condition and
// a set of effects to execute. Each scaffold includes a trigger spec, effect
// handler stubs, and a sync manifest that wires them together.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SyncScaffoldGenStorage,
  SyncScaffoldGenGenerateInput,
  SyncScaffoldGenGenerateOutput,
  SyncScaffoldGenPreviewInput,
  SyncScaffoldGenPreviewOutput,
  SyncScaffoldGenRegisterInput,
  SyncScaffoldGenRegisterOutput,
} from './types.js';

import {
  generateOk,
  generateError,
  previewOk,
  previewCached,
  previewError,
  registerOk,
} from './types.js';

export interface SyncScaffoldGenError {
  readonly code: string;
  readonly message: string;
}

export interface SyncScaffoldGenHandler {
  readonly generate: (
    input: SyncScaffoldGenGenerateInput,
    storage: SyncScaffoldGenStorage,
  ) => TE.TaskEither<SyncScaffoldGenError, SyncScaffoldGenGenerateOutput>;
  readonly preview: (
    input: SyncScaffoldGenPreviewInput,
    storage: SyncScaffoldGenStorage,
  ) => TE.TaskEither<SyncScaffoldGenError, SyncScaffoldGenPreviewOutput>;
  readonly register: (
    input: SyncScaffoldGenRegisterInput,
    storage: SyncScaffoldGenStorage,
  ) => TE.TaskEither<SyncScaffoldGenError, SyncScaffoldGenRegisterOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): SyncScaffoldGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Extract a human-readable name from a trigger descriptor. */
const triggerName = (trigger: unknown): string => {
  if (typeof trigger === 'string') return trigger;
  if (typeof trigger === 'object' && trigger !== null && 'name' in trigger) {
    return String((trigger as Record<string, unknown>)['name']);
  }
  return 'default';
};

/** Extract a human-readable name from an effect descriptor. */
const effectName = (effect: unknown): string => {
  if (typeof effect === 'string') return effect;
  if (typeof effect === 'object' && effect !== null && 'name' in effect) {
    return String((effect as Record<string, unknown>)['name']);
  }
  return 'unknown-effect';
};

/** Build sync rule scaffold files. */
const buildSyncFiles = (
  name: string,
  trigger: unknown,
  effects: readonly unknown[],
): readonly Record<string, unknown>[] => {
  const trigName = triggerName(trigger);
  const files: Record<string, unknown>[] = [];

  // Sync manifest
  files.push({
    path: `sync/${name}/sync.yaml`,
    kind: 'sync-manifest',
    content: [
      `# Sync rule: ${name}`,
      `name: ${name}`,
      `trigger: ${trigName}`,
      `effects:`,
      ...effects.map((e) => `  - ${effectName(e)}`),
    ].join('\n'),
  });

  // Trigger spec
  files.push({
    path: `sync/${name}/trigger.ts`,
    kind: 'trigger',
    content: [
      `// Trigger: ${trigName} for sync rule ${name}`,
      `export const trigger = {`,
      `  name: '${trigName}',`,
      `  evaluate: async (context: unknown): Promise<boolean> => {`,
      `    // TODO: implement trigger condition`,
      `    return true;`,
      `  },`,
      `};`,
    ].join('\n'),
  });

  // Per-effect handler stubs
  for (const effect of effects) {
    const eName = effectName(effect);
    files.push({
      path: `sync/${name}/effects/${eName}.handler.ts`,
      kind: 'effect-handler',
      content: [
        `// Effect handler: ${eName} for sync rule ${name}`,
        `export const ${eName.replace(/-/g, '_')}Effect = async (context: unknown): Promise<void> => {`,
        `  // TODO: implement effect`,
        `};`,
      ].join('\n'),
    });
  }

  // Index barrel
  files.push({
    path: `sync/${name}/index.ts`,
    kind: 'barrel',
    content: `export { trigger } from './trigger.js';`,
  });

  return files;
};

// --- Implementation ---

export const syncScaffoldGenHandler: SyncScaffoldGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { name, trigger, effects } = input;

          if (name.trim().length === 0) {
            return generateError('Sync rule name must be non-empty');
          }

          const files = buildSyncFiles(name, trigger, effects);

          await storage.put('scaffolds', name, {
            name,
            trigger,
            effects: [...effects],
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
          const { name, trigger, effects } = input;

          if (name.trim().length === 0) {
            return previewError('Sync rule name must be non-empty');
          }

          const existing = await storage.get('scaffolds', name);

          return pipe(
            O.fromNullable(existing),
            O.fold(
              () => {
                const files = buildSyncFiles(name, trigger, effects);
                return previewOk(files, files.length, 0);
              },
              (cached) => {
                const cachedFiles = (cached['files'] as readonly unknown[]) ?? [];
                const newFiles = buildSyncFiles(name, trigger, effects);

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
          'sync-scaffold-gen',
          'SyncScaffoldGenGenerateInput',
          'SyncScaffoldGenGenerateOutput',
          ['generate', 'preview', 'trigger', 'effect-handler'],
        ),
      ),
    ),
};
