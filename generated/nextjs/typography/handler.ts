// Typography — type scale management, rem computation, font stack definition, and text style registry.
// Generates modular scales (major third, perfect fourth, etc.), manages named font stacks,
// and defines reusable text styles with size, weight, line-height, and letter-spacing.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TypographyStorage,
  TypographyDefineScaleInput,
  TypographyDefineScaleOutput,
  TypographyDefineFontStackInput,
  TypographyDefineFontStackOutput,
  TypographyDefineStyleInput,
  TypographyDefineStyleOutput,
} from './types.js';

import {
  defineScaleOk,
  defineScaleInvalid,
  defineFontStackOk,
  defineFontStackDuplicate,
  defineStyleOk,
  defineStyleInvalid,
} from './types.js';

export interface TypographyError {
  readonly code: string;
  readonly message: string;
}

const storageErr = (error: unknown): TypographyError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Default root font size in px for rem computation. */
const ROOT_FONT_SIZE = 16;

/** Compute a modular type scale. Each step multiplies baseSize by ratio^step. */
const computeModularScale = (
  baseSize: number,
  ratio: number,
  steps: number,
): readonly { readonly step: number; readonly px: number; readonly rem: string }[] => {
  const result: { readonly step: number; readonly px: number; readonly rem: string }[] = [];
  // Generate steps from negative half to positive half, centered on 0
  const halfDown = Math.floor(steps / 2);
  for (let i = -halfDown; i < steps - halfDown; i++) {
    const px = Math.round(baseSize * Math.pow(ratio, i) * 100) / 100;
    const rem = `${Math.round((px / ROOT_FONT_SIZE) * 10000) / 10000}rem`;
    result.push({ step: i, px, rem });
  }
  return result;
};

/** Calculate line-height from font size: smaller text gets more spacing. */
const computeLineHeight = (pxSize: number): number => {
  // Heuristic: line-height decreases as font size increases, clamped between 1.2 and 1.75
  const lh = 1.75 - (pxSize - 12) * 0.008;
  return Math.round(Math.max(1.2, Math.min(1.75, lh)) * 100) / 100;
};

const VALID_CATEGORIES = ['serif', 'sans-serif', 'monospace', 'display', 'handwriting'] as const;

export interface TypographyHandler {
  readonly defineScale: (
    input: TypographyDefineScaleInput,
    storage: TypographyStorage,
  ) => TE.TaskEither<TypographyError, TypographyDefineScaleOutput>;
  readonly defineFontStack: (
    input: TypographyDefineFontStackInput,
    storage: TypographyStorage,
  ) => TE.TaskEither<TypographyError, TypographyDefineFontStackOutput>;
  readonly defineStyle: (
    input: TypographyDefineStyleInput,
    storage: TypographyStorage,
  ) => TE.TaskEither<TypographyError, TypographyDefineStyleOutput>;
}

// --- Implementation ---

export const typographyHandler: TypographyHandler = {
  defineScale: (input, storage) =>
    pipe(
      TE.right(input),
      TE.chain((inp) => {
        if (inp.baseSize <= 0) {
          return TE.right(defineScaleInvalid('Base size must be a positive number'));
        }
        if (inp.ratio <= 1) {
          return TE.right(
            defineScaleInvalid('Scale ratio must be greater than 1 (e.g. 1.25 for major third)'),
          );
        }
        if (inp.steps < 2 || inp.steps > 20) {
          return TE.right(defineScaleInvalid('Steps must be between 2 and 20'));
        }

        const scale = computeModularScale(inp.baseSize, inp.ratio, inp.steps);
        // Enrich each step with computed line-height
        const enriched = scale.map((s) => ({
          ...s,
          lineHeight: computeLineHeight(s.px),
        }));

        return TE.tryCatch(
          async () => {
            await storage.put('scale', inp.typography, {
              typography: inp.typography,
              baseSize: inp.baseSize,
              ratio: inp.ratio,
              steps: inp.steps,
              scale: enriched,
            });
            return defineScaleOk(inp.typography, JSON.stringify(enriched));
          },
          storageErr,
        );
      }),
    ),

  defineFontStack: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('fontstack', `${input.typography}::${input.name}`),
        storageErr,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () => {
              // Validate category
              if (!(VALID_CATEGORIES as readonly string[]).includes(input.category)) {
                return TE.right(
                  defineFontStackDuplicate(
                    `Invalid category '${input.category}'. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
                  ),
                );
              }
              // Validate fonts is a non-empty comma-separated list
              const fontList = input.fonts.split(',').map((f) => f.trim()).filter((f) => f.length > 0);
              if (fontList.length === 0) {
                return TE.right(
                  defineFontStackDuplicate('Font stack must contain at least one font family'),
                );
              }

              return TE.tryCatch(
                async () => {
                  // Build the CSS font-family value with proper quoting
                  const cssValue = fontList
                    .map((f) => (f.includes(' ') ? `"${f}"` : f))
                    .join(', ');

                  await storage.put('fontstack', `${input.typography}::${input.name}`, {
                    typography: input.typography,
                    name: input.name,
                    fonts: fontList,
                    category: input.category,
                    cssValue,
                  });
                  return defineFontStackOk(input.typography);
                },
                storageErr,
              );
            },
            () =>
              TE.right(
                defineFontStackDuplicate(
                  `Font stack '${input.name}' already exists on typography '${input.typography}'`,
                ),
              ),
          ),
        ),
      ),
    ),

  defineStyle: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const parsed: unknown = JSON.parse(input.config);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return defineStyleInvalid('Style config must be a JSON object');
          }
          const cfg = parsed as Record<string, unknown>;

          // Validate required scaleStep or fontSize
          if (cfg.scaleStep === undefined && cfg.fontSize === undefined) {
            return defineStyleInvalid(
              'Style config must include either "scaleStep" (number) or "fontSize" (number in px)',
            );
          }

          await storage.put('style', `${input.typography}::${input.name}`, {
            typography: input.typography,
            name: input.name,
            config: cfg,
          });
          return defineStyleOk(input.typography);
        },
        (error) => {
          if (error instanceof SyntaxError) {
            return {
              code: 'PARSE_ERROR',
              message: `Invalid JSON in style config: ${error.message}`,
            } as TypographyError;
          }
          return storageErr(error);
        },
      ),
    ),
};
