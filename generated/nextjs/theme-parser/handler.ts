// ThemeParser — Parse theme spec files into AST with contrast-ratio accessibility checks
// Validates theme token structure and runs WCAG-style contrast checks on color pairs.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ThemeParserStorage,
  ThemeParserParseInput,
  ThemeParserParseOutput,
  ThemeParserCheckContrastInput,
  ThemeParserCheckContrastOutput,
} from './types.js';

import {
  parseOk,
  parseError,
  checkContrastOk,
  checkContrastViolations,
} from './types.js';

export interface ThemeParserError {
  readonly code: string;
  readonly message: string;
}

export interface ThemeParserHandler {
  readonly parse: (
    input: ThemeParserParseInput,
    storage: ThemeParserStorage,
  ) => TE.TaskEither<ThemeParserError, ThemeParserParseOutput>;
  readonly checkContrast: (
    input: ThemeParserCheckContrastInput,
    storage: ThemeParserStorage,
  ) => TE.TaskEither<ThemeParserError, ThemeParserCheckContrastOutput>;
}

// --- Helpers ---

const toError = (error: unknown): ThemeParserError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Required top-level sections in a theme spec. */
const REQUIRED_SECTIONS: readonly string[] = ['colors', 'typography'];

/** Parse a hex color string into RGB components. Returns null if invalid. */
const parseHexColor = (hex: string): { readonly r: number; readonly g: number; readonly b: number } | null => {
  const match = /^#?([a-fA-F0-9]{6})$/.exec(hex.trim());
  if (!match) return null;
  const val = match[1];
  return {
    r: parseInt(val.substring(0, 2), 16),
    g: parseInt(val.substring(2, 4), 16),
    b: parseInt(val.substring(4, 6), 16),
  };
};

/** Compute relative luminance per WCAG 2.0. */
const relativeLuminance = (r: number, g: number, b: number): number => {
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

/** Compute contrast ratio between two colors. */
const contrastRatio = (
  fg: { readonly r: number; readonly g: number; readonly b: number },
  bg: { readonly r: number; readonly g: number; readonly b: number },
): number => {
  const lum1 = relativeLuminance(fg.r, fg.g, fg.b);
  const lum2 = relativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
};

/** WCAG AA minimum contrast ratios. */
const MIN_CONTRAST_NORMAL = 4.5;
const MIN_CONTRAST_LARGE = 3.0;

// --- Implementation ---

export const themeParserHandler: ThemeParserHandler = {
  // Parse a theme spec source into a structured AST
  parse: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(input.source) as Record<string, unknown>;
          } catch (e) {
            return parseError(input.theme, [`Syntax error: ${e instanceof Error ? e.message : String(e)}`]);
          }
          const errors: string[] = [];
          for (const section of REQUIRED_SECTIONS) {
            if (!(section in parsed)) {
              errors.push(`Missing required section '${section}'`);
            }
          }
          // Validate color values
          const colors = parsed['colors'] as Record<string, unknown> | undefined;
          if (colors !== undefined && typeof colors === 'object') {
            for (const [name, value] of Object.entries(colors)) {
              if (typeof value === 'string' && !parseHexColor(value)) {
                errors.push(`Invalid color value for '${name}': '${value}' (expected hex format)`);
              }
            }
          }
          if (errors.length > 0) {
            return parseError(input.theme, errors);
          }
          // Build normalized theme AST
          const ast: Record<string, unknown> = {
            name: input.theme,
            colors: parsed['colors'] ?? {},
            typography: parsed['typography'] ?? {},
            spacing: parsed['spacing'] ?? {},
            elevation: parsed['elevation'] ?? {},
            breakpoints: parsed['breakpoints'] ?? {},
          };
          const astStr = JSON.stringify(ast);
          await storage.put('theme_ast', input.theme, {
            theme: input.theme,
            ast: astStr,
            source: input.source,
            parsedAt: new Date().toISOString(),
          });
          return parseOk(input.theme, astStr);
        },
        toError,
      ),
    ),

  // Check WCAG contrast compliance for foreground/background color pairs
  checkContrast: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('theme_ast', input.theme),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(checkContrastViolations(input.theme, [`Theme '${input.theme}' has not been parsed yet`]) as ThemeParserCheckContrastOutput),
            (found) => {
              let ast: Record<string, unknown>;
              try {
                ast = JSON.parse(String(found['ast'] ?? '{}')) as Record<string, unknown>;
              } catch {
                return TE.right(checkContrastViolations(input.theme, ['Stored AST is corrupted']) as ThemeParserCheckContrastOutput);
              }
              const colors = ast['colors'] as Record<string, string> | undefined;
              if (!colors || typeof colors !== 'object') {
                return TE.right(checkContrastOk(input.theme) as ThemeParserCheckContrastOutput);
              }
              // Check common foreground/background pairs
              const failures: string[] = [];
              const fgKeys = Object.keys(colors).filter((k) => k.includes('foreground') || k.includes('text') || k.includes('fg'));
              const bgKeys = Object.keys(colors).filter((k) => k.includes('background') || k.includes('surface') || k.includes('bg'));
              for (const fgKey of fgKeys) {
                const fg = parseHexColor(colors[fgKey]);
                if (!fg) continue;
                for (const bgKey of bgKeys) {
                  const bg = parseHexColor(colors[bgKey]);
                  if (!bg) continue;
                  const ratio = contrastRatio(fg, bg);
                  if (ratio < MIN_CONTRAST_NORMAL) {
                    failures.push(
                      `${fgKey}/${bgKey}: contrast ratio ${ratio.toFixed(2)} < ${MIN_CONTRAST_NORMAL} (WCAG AA)`,
                    );
                  }
                }
              }
              if (failures.length > 0) {
                return TE.right(checkContrastViolations(input.theme, failures) as ThemeParserCheckContrastOutput);
              }
              return TE.right(checkContrastOk(input.theme) as ThemeParserCheckContrastOutput);
            },
          ),
        ),
      ),
    ),
};
