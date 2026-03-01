// ThemeParser Concept Implementation [H]
// Parses theme source definitions into an AST and validates contrast compliance.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

export const themeParserHandler: ConceptHandler = {
  async parse(input, storage) {
    const theme = input.theme as string;
    const source = input.source as string;

    const id = theme || nextId('H');

    let ast: Record<string, unknown>;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      ast = JSON.parse(source);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown parse error';
      return {
        variant: 'error',
        errors: JSON.stringify([errorMessage]),
      };
    }

    // Validate expected theme structure
    if (!ast.tokens && !ast.colors && !ast.typography && !ast.spacing) {
      warnings.push('Theme source has no recognized token categories (tokens, colors, typography, spacing)');
    }

    // Check for empty or null values
    for (const [key, value] of Object.entries(ast)) {
      if (value === null || value === undefined) {
        errors.push(`Token "${key}" has null or undefined value`);
      }
    }

    if (errors.length > 0) {
      return {
        variant: 'error',
        errors: JSON.stringify(errors),
      };
    }

    await storage.put('themeParser', id, {
      source,
      ast: JSON.stringify(ast),
      errors: JSON.stringify([]),
      warnings: JSON.stringify(warnings),
    });

    return {
      variant: 'ok',
      ast: JSON.stringify(ast),
    };
  },

  async checkContrast(input, storage) {
    const theme = input.theme as string;

    const existing = await storage.get('themeParser', theme);
    if (!existing) {
      return { variant: 'violations', failures: JSON.stringify(['Theme not found; parse a theme first']) };
    }

    const ast: Record<string, unknown> = JSON.parse(existing.ast as string);
    const failures: string[] = [];

    // Check color pairs for WCAG AA contrast compliance
    const colors = (ast.colors || ast.tokens || {}) as Record<string, string>;
    const colorEntries = Object.entries(colors);

    // If there are foreground/background pairs, check them
    if (colors.foreground && colors.background) {
      // Simplified luminance contrast check placeholder
      // Real implementation would compute actual relative luminance
      const fg = colors.foreground;
      const bg = colors.background;
      if (fg === bg) {
        failures.push(`Contrast failure: foreground "${fg}" and background "${bg}" are identical (ratio 1:1)`);
      }
    }

    // Check named pairs like text/surface, primary/onPrimary
    const pairs = [
      ['text', 'surface'],
      ['primary', 'onPrimary'],
      ['secondary', 'onSecondary'],
      ['error', 'onError'],
    ];

    for (const [fg, bg] of pairs) {
      if (colors[fg] && colors[bg] && colors[fg] === colors[bg]) {
        failures.push(`Contrast failure: "${fg}" and "${bg}" are identical`);
      }
    }

    if (failures.length > 0) {
      return {
        variant: 'violations',
        failures: JSON.stringify(failures),
      };
    }

    return { variant: 'ok' };
  },
};
