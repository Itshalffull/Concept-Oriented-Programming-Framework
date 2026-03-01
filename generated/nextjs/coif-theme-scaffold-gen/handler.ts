// CoifThemeScaffoldGen — Theme scaffold generator for Surface themes.
// Produces palette, typography, motion, and elevation token files for a
// named design theme. Supports light/dark mode selection and configurable
// primary colour, font family, and base sizing scale.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  CoifThemeScaffoldGenStorage,
  CoifThemeScaffoldGenGenerateInput,
  CoifThemeScaffoldGenGenerateOutput,
  CoifThemeScaffoldGenPreviewInput,
  CoifThemeScaffoldGenPreviewOutput,
  CoifThemeScaffoldGenRegisterInput,
  CoifThemeScaffoldGenRegisterOutput,
} from './types.js';

import {
  generateOk,
  generateError,
  previewOk,
  previewCached,
  previewError,
  registerOk,
} from './types.js';

export interface CoifThemeScaffoldGenError {
  readonly code: string;
  readonly message: string;
}

export interface CoifThemeScaffoldGenHandler {
  readonly generate: (
    input: CoifThemeScaffoldGenGenerateInput,
    storage: CoifThemeScaffoldGenStorage,
  ) => TE.TaskEither<CoifThemeScaffoldGenError, CoifThemeScaffoldGenGenerateOutput>;
  readonly preview: (
    input: CoifThemeScaffoldGenPreviewInput,
    storage: CoifThemeScaffoldGenStorage,
  ) => TE.TaskEither<CoifThemeScaffoldGenError, CoifThemeScaffoldGenPreviewOutput>;
  readonly register: (
    input: CoifThemeScaffoldGenRegisterInput,
    storage: CoifThemeScaffoldGenStorage,
  ) => TE.TaskEither<CoifThemeScaffoldGenError, CoifThemeScaffoldGenRegisterOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): CoifThemeScaffoldGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Validate a hex colour string. */
const isValidHexColor = (color: string): boolean =>
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color);

/** Supported mode values. */
const VALID_MODES: ReadonlySet<string> = new Set(['light', 'dark', 'auto']);

/** Build the type scale array from a base size using a 1.25 ratio. */
const buildTypeScale = (baseSize: number): readonly number[] => {
  const ratio = 1.25;
  const steps = 7; // xs, sm, base, lg, xl, 2xl, 3xl
  const result: number[] = [];
  for (let i = -2; i <= steps - 3; i++) {
    result.push(Math.round(baseSize * Math.pow(ratio, i) * 100) / 100);
  }
  return result;
};

/** Build theme scaffold files from input parameters. */
const buildThemeFiles = (
  name: string,
  primaryColor: string,
  fontFamily: string,
  baseSize: number,
  mode: string,
): readonly Record<string, unknown>[] => {
  const typeScale = buildTypeScale(baseSize);

  return [
    {
      path: `themes/${name}/palette.tokens.ts`,
      kind: 'palette',
      content: `// Palette tokens for ${name}\nexport const primary = '${primaryColor}';\nexport const mode = '${mode}';`,
    },
    {
      path: `themes/${name}/typography.tokens.ts`,
      kind: 'typography',
      content: `// Typography tokens for ${name}\nexport const fontFamily = '${fontFamily}';\nexport const typeScale = ${JSON.stringify(typeScale)};`,
    },
    {
      path: `themes/${name}/motion.tokens.ts`,
      kind: 'motion',
      content: `// Motion tokens for ${name}\nexport const durationFast = '150ms';\nexport const durationNormal = '300ms';\nexport const durationSlow = '500ms';`,
    },
    {
      path: `themes/${name}/elevation.tokens.ts`,
      kind: 'elevation',
      content: `// Elevation tokens for ${name}\nexport const levels = [0, 1, 2, 4, 8, 16];`,
    },
    {
      path: `themes/${name}/index.ts`,
      kind: 'barrel',
      content: `export * from './palette.tokens.js';\nexport * from './typography.tokens.js';\nexport * from './motion.tokens.js';\nexport * from './elevation.tokens.js';`,
    },
    {
      path: `themes/${name}/theme.concept`,
      kind: 'concept-spec',
      content: `theme ${name} {\n  palette: "./palette.tokens"\n  typography: "./typography.tokens"\n  motion: "./motion.tokens"\n  elevation: "./elevation.tokens"\n}`,
    },
  ];
};

// --- Implementation ---

export const coifThemeScaffoldGenHandler: CoifThemeScaffoldGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { name, primaryColor, fontFamily, baseSize, mode } = input;

          if (name.trim().length === 0) {
            return generateError('Theme name must be non-empty');
          }

          if (!isValidHexColor(primaryColor)) {
            return generateError(
              `Invalid primary colour '${primaryColor}'. Must be a hex colour (e.g. #3b82f6)`,
            );
          }

          if (!VALID_MODES.has(mode)) {
            return generateError(
              `Invalid mode '${mode}'. Must be one of: ${[...VALID_MODES].join(', ')}`,
            );
          }

          if (baseSize <= 0 || baseSize > 128) {
            return generateError(
              `Base size must be between 1 and 128, got ${baseSize}`,
            );
          }

          const files = buildThemeFiles(name, primaryColor, fontFamily, baseSize, mode);

          await storage.put('scaffolds', name, {
            name,
            primaryColor,
            fontFamily,
            baseSize,
            mode,
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
          const { name, primaryColor, fontFamily, baseSize, mode } = input;

          if (name.trim().length === 0) {
            return previewError('Theme name must be non-empty');
          }

          const existing = await storage.get('scaffolds', name);

          return pipe(
            O.fromNullable(existing),
            O.fold(
              () => {
                const files = buildThemeFiles(name, primaryColor, fontFamily, baseSize, mode);
                return previewOk(files, files.length, 0);
              },
              (cached) => {
                const cachedFiles = (cached['files'] as readonly unknown[]) ?? [];
                const newFiles = buildThemeFiles(name, primaryColor, fontFamily, baseSize, mode);

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
          'coif-theme-scaffold-gen',
          'CoifThemeScaffoldGenGenerateInput',
          'CoifThemeScaffoldGenGenerateOutput',
          ['generate', 'preview', 'palette', 'typography', 'motion', 'elevation'],
        ),
      ),
    ),
};
