// Elevation — z-index scale management, layer assignment, and stacking order resolution.
// Defines named elevation levels with shadow values and generates complete shadow scales
// from a base color for consistent depth perception across the UI.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ElevationStorage,
  ElevationDefineInput,
  ElevationDefineOutput,
  ElevationGetInput,
  ElevationGetOutput,
  ElevationGenerateScaleInput,
  ElevationGenerateScaleOutput,
} from './types.js';

import {
  defineOk,
  defineInvalid,
  getOk,
  getNotfound,
  generateScaleOk,
  generateScaleInvalid,
} from './types.js';

export interface ElevationError {
  readonly code: string;
  readonly message: string;
}

const storageErr = (error: unknown): ElevationError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Maximum supported elevation level. Levels map to z-index tiers. */
const MAX_LEVEL = 24;

/** Predefined elevation scale with 6 tiers of increasing depth. */
const ELEVATION_SHADOWS: readonly string[] = [
  'none',
  '0 1px 2px 0 rgba(R,G,B,0.05)',
  '0 1px 3px 0 rgba(R,G,B,0.1), 0 1px 2px -1px rgba(R,G,B,0.1)',
  '0 4px 6px -1px rgba(R,G,B,0.1), 0 2px 4px -2px rgba(R,G,B,0.1)',
  '0 10px 15px -3px rgba(R,G,B,0.1), 0 4px 6px -4px rgba(R,G,B,0.1)',
  '0 20px 25px -5px rgba(R,G,B,0.1), 0 8px 10px -6px rgba(R,G,B,0.1)',
  '0 25px 50px -12px rgba(R,G,B,0.25)',
];

/** Parse a hex color string (#RGB or #RRGGBB) into [r, g, b]. */
const parseHexColor = (hex: string): readonly [number, number, number] | null => {
  const cleaned = hex.replace(/^#/, '');
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : [r, g, b] as const;
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : [r, g, b] as const;
  }
  return null;
};

export interface ElevationHandler {
  readonly define: (
    input: ElevationDefineInput,
    storage: ElevationStorage,
  ) => TE.TaskEither<ElevationError, ElevationDefineOutput>;
  readonly get: (
    input: ElevationGetInput,
    storage: ElevationStorage,
  ) => TE.TaskEither<ElevationError, ElevationGetOutput>;
  readonly generateScale: (
    input: ElevationGenerateScaleInput,
    storage: ElevationStorage,
  ) => TE.TaskEither<ElevationError, ElevationGenerateScaleOutput>;
}

// --- Implementation ---

export const elevationHandler: ElevationHandler = {
  define: (input, storage) =>
    pipe(
      TE.right(input),
      TE.chain((inp) => {
        if (inp.level < 0 || inp.level > MAX_LEVEL) {
          return TE.right(
            defineInvalid(`Elevation level must be between 0 and ${MAX_LEVEL}, got ${inp.level}`),
          );
        }
        if (inp.shadow.trim().length === 0) {
          return TE.right(defineInvalid('Shadow value must not be empty'));
        }
        return TE.tryCatch(
          async () => {
            await storage.put('elevation', inp.elevation, {
              elevation: inp.elevation,
              level: inp.level,
              shadow: inp.shadow,
              zIndex: inp.level * 100,
            });
            return defineOk(inp.elevation);
          },
          storageErr,
        );
      }),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('elevation', input.elevation),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound(`Elevation '${input.elevation}' not found`)),
            (found) =>
              TE.right(getOk(input.elevation, String((found as any).shadow ?? 'none'))),
          ),
        ),
      ),
    ),

  generateScale: (input, storage) =>
    pipe(
      TE.right(input.baseColor),
      TE.chain((baseColor) => {
        const rgb = parseHexColor(baseColor);
        if (rgb === null) {
          return TE.right(
            generateScaleInvalid(
              `Invalid hex color '${baseColor}'. Expected format: #RGB or #RRGGBB`,
            ),
          );
        }
        const [r, g, b] = rgb;
        // Substitute the RGB placeholders into each shadow template
        const shadows = ELEVATION_SHADOWS.map((template) =>
          template
            .replace(/R/g, String(r))
            .replace(/G/g, String(g))
            .replace(/B/g, String(b)),
        );

        return TE.tryCatch(
          async () => {
            // Persist each generated level
            for (let i = 0; i < shadows.length; i++) {
              await storage.put('elevation', `generated-${i}`, {
                elevation: `generated-${i}`,
                level: i,
                shadow: shadows[i],
                zIndex: i * 100,
                baseColor,
              });
            }
            return generateScaleOk(JSON.stringify(shadows));
          },
          storageErr,
        );
      }),
    ),
};
