// Palette — color token management, color scale generation, and WCAG contrast ratio calculation.
// Generates tint/shade scales from a seed color, assigns semantic roles (primary, error, etc.),
// and checks foreground/background pairs against WCAG AA (4.5:1) and AAA (7:1) thresholds.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  PaletteStorage,
  PaletteGenerateInput,
  PaletteGenerateOutput,
  PaletteAssignRoleInput,
  PaletteAssignRoleOutput,
  PaletteCheckContrastInput,
  PaletteCheckContrastOutput,
} from './types.js';

import {
  generateOk,
  generateInvalid,
  assignRoleOk,
  assignRoleNotfound,
  checkContrastOk,
  checkContrastNotfound,
} from './types.js';

export interface PaletteError {
  readonly code: string;
  readonly message: string;
}

const storageErr = (error: unknown): PaletteError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse hex (#RGB or #RRGGBB) into [r, g, b] in 0-255 range. */
const parseHex = (hex: string): readonly [number, number, number] | null => {
  const cleaned = hex.replace(/^#/, '');
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return Number.isNaN(r + g + b) ? null : [r, g, b] as const;
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return Number.isNaN(r + g + b) ? null : [r, g, b] as const;
  }
  return null;
};

/** Convert a single sRGB channel (0-255) to its linear value for luminance calculation. */
const linearize = (channel: number): number => {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
};

/** Compute relative luminance per WCAG 2.x definition. */
const relativeLuminance = (r: number, g: number, b: number): number =>
  0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);

/** WCAG contrast ratio between two luminance values. */
const contrastRatio = (l1: number, l2: number): number => {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

/** Mix a color with white or black to generate tints and shades. */
const mixChannel = (c: number, target: number, factor: number): number =>
  Math.round(c + (target - c) * factor);

const toHex = (n: number): string => n.toString(16).padStart(2, '0');

/** Generate a 10-step tint/shade scale from a seed color. Steps 0-4 are tints, 5 is base, 6-9 are shades. */
const generateScale = (
  r: number,
  g: number,
  b: number,
): readonly string[] => {
  const tintFactors = [0.9, 0.7, 0.5, 0.3, 0.1];
  const shadeFactors = [0.1, 0.3, 0.5, 0.7];

  const tints = tintFactors.map((f) =>
    `#${toHex(mixChannel(r, 255, f))}${toHex(mixChannel(g, 255, f))}${toHex(mixChannel(b, 255, f))}`,
  );
  const base = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  const shades = shadeFactors.map((f) =>
    `#${toHex(mixChannel(r, 0, f))}${toHex(mixChannel(g, 0, f))}${toHex(mixChannel(b, 0, f))}`,
  );

  return [...tints, base, ...shades];
};

export interface PaletteHandler {
  readonly generate: (
    input: PaletteGenerateInput,
    storage: PaletteStorage,
  ) => TE.TaskEither<PaletteError, PaletteGenerateOutput>;
  readonly assignRole: (
    input: PaletteAssignRoleInput,
    storage: PaletteStorage,
  ) => TE.TaskEither<PaletteError, PaletteAssignRoleOutput>;
  readonly checkContrast: (
    input: PaletteCheckContrastInput,
    storage: PaletteStorage,
  ) => TE.TaskEither<PaletteError, PaletteCheckContrastOutput>;
}

// --- Implementation ---

export const paletteHandler: PaletteHandler = {
  generate: (input, storage) =>
    pipe(
      TE.right(input.seed),
      TE.chain((seed) => {
        const rgb = parseHex(seed);
        if (rgb === null) {
          return TE.right(
            generateInvalid(`Invalid hex color '${seed}'. Expected #RGB or #RRGGBB`),
          );
        }
        const [r, g, b] = rgb;
        const scale = generateScale(r, g, b);

        return TE.tryCatch(
          async () => {
            await storage.put('palette', input.palette, {
              palette: input.palette,
              name: input.name,
              seed,
              scale,
            });
            return generateOk(input.palette, JSON.stringify(scale));
          },
          storageErr,
        );
      }),
    ),

  assignRole: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('palette', input.palette),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(assignRoleNotfound(`Palette '${input.palette}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const updated = { ...existing, role: input.role };
                  await storage.put('palette', input.palette, updated);
                  return assignRoleOk(input.palette);
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),

  checkContrast: (input, storage) =>
    pipe(
      TE.right({ fg: input.foreground, bg: input.background }),
      TE.chain(({ fg, bg }) => {
        const fgRgb = parseHex(fg);
        const bgRgb = parseHex(bg);

        if (fgRgb === null) {
          return TE.right(
            checkContrastNotfound(`Invalid foreground color '${fg}'`),
          );
        }
        if (bgRgb === null) {
          return TE.right(
            checkContrastNotfound(`Invalid background color '${bg}'`),
          );
        }

        const fgLum = relativeLuminance(fgRgb[0], fgRgb[1], fgRgb[2]);
        const bgLum = relativeLuminance(bgRgb[0], bgRgb[1], bgRgb[2]);
        const ratio = Math.round(contrastRatio(fgLum, bgLum) * 100) / 100;

        // WCAG AA requires 4.5:1 for normal text, AAA requires 7:1
        const passesAA = ratio >= 4.5;
        const passesAAA = ratio >= 7;

        return TE.right(checkContrastOk(ratio, passesAA, passesAAA));
      }),
    ),
};
