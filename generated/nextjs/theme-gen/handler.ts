// ThemeGen — Theme code generator producing CSS custom properties and SCSS token maps
// Transforms a parsed theme AST into framework-consumable design token output.

import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

import type {
  ThemeGenStorage,
  ThemeGenGenerateInput,
  ThemeGenGenerateOutput,
} from './types.js';

import {
  generateOk,
  generateError,
} from './types.js';

export interface ThemeGenError {
  readonly code: string;
  readonly message: string;
}

export interface ThemeGenHandler {
  readonly generate: (
    input: ThemeGenGenerateInput,
    storage: ThemeGenStorage,
  ) => TE.TaskEither<ThemeGenError, ThemeGenGenerateOutput>;
}

// --- Helpers ---

const toError = (error: unknown): ThemeGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const SUPPORTED_TARGETS: readonly string[] = ['css', 'scss', 'tailwind', 'json'];

/** Convert a camelCase or PascalCase token name to kebab-case. */
const toKebabCase = (name: string): string =>
  name.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase();

/** Generate a flat record of token entries from a nested AST section. */
const flattenTokens = (
  section: string,
  values: Record<string, unknown>,
  prefix: string = '',
): readonly { readonly name: string; readonly value: string }[] => {
  const tokens: { readonly name: string; readonly value: string }[] = [];
  for (const [key, val] of Object.entries(values)) {
    const fullKey = prefix ? `${prefix}-${toKebabCase(key)}` : `${section}-${toKebabCase(key)}`;
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      tokens.push(...flattenTokens(section, val as Record<string, unknown>, fullKey));
    } else {
      tokens.push({ name: fullKey, value: String(val) });
    }
  }
  return tokens;
};

/** Generate CSS custom properties output. */
const generateCss = (themeName: string, ast: Record<string, unknown>): string => {
  const sections = ['colors', 'typography', 'spacing', 'elevation', 'breakpoints'] as const;
  const allTokens: { readonly name: string; readonly value: string }[] = [];
  for (const section of sections) {
    const sectionData = ast[section];
    if (typeof sectionData === 'object' && sectionData !== null) {
      allTokens.push(...flattenTokens(section, sectionData as Record<string, unknown>));
    }
  }
  const vars = allTokens.map((t) => `  --${t.name}: ${t.value};`).join('\n');
  return `/* Theme: ${themeName} */\n:root {\n${vars}\n}`;
};

/** Generate SCSS variables and maps output. */
const generateScss = (themeName: string, ast: Record<string, unknown>): string => {
  const sections = ['colors', 'typography', 'spacing', 'elevation', 'breakpoints'] as const;
  const lines: string[] = [`// Theme: ${themeName}`, ''];
  for (const section of sections) {
    const sectionData = ast[section];
    if (typeof sectionData === 'object' && sectionData !== null) {
      const tokens = flattenTokens(section, sectionData as Record<string, unknown>);
      for (const t of tokens) {
        lines.push(`$${t.name}: ${t.value};`);
      }
      // Also emit a map for the section
      const mapEntries = tokens.map((t) => `  '${t.name}': $${t.name}`).join(',\n');
      lines.push(`\n$${section}-map: (\n${mapEntries}\n);`);
      lines.push('');
    }
  }
  return lines.join('\n');
};

/** Generate a Tailwind config extension. */
const generateTailwind = (themeName: string, ast: Record<string, unknown>): string => {
  const colors = ast['colors'] as Record<string, unknown> | undefined;
  const spacing = ast['spacing'] as Record<string, unknown> | undefined;
  const config: Record<string, unknown> = {};
  if (colors && typeof colors === 'object') config['colors'] = colors;
  if (spacing && typeof spacing === 'object') config['spacing'] = spacing;
  return `// Theme: ${themeName} — Tailwind extend config\nmodule.exports = {\n  theme: {\n    extend: ${JSON.stringify(config, null, 6).replace(/^/gm, '    ').trimStart()}\n  }\n};`;
};

/** Generate a JSON token export. */
const generateJson = (themeName: string, ast: Record<string, unknown>): string => {
  const sections = ['colors', 'typography', 'spacing', 'elevation', 'breakpoints'] as const;
  const allTokens: Record<string, string> = {};
  for (const section of sections) {
    const sectionData = ast[section];
    if (typeof sectionData === 'object' && sectionData !== null) {
      for (const t of flattenTokens(section, sectionData as Record<string, unknown>)) {
        allTokens[t.name] = t.value;
      }
    }
  }
  return JSON.stringify({ theme: themeName, tokens: allTokens }, null, 2);
};

// --- Implementation ---

export const themeGenHandler: ThemeGenHandler = {
  // Generate design token output from a parsed theme AST for the specified target format
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          if (!SUPPORTED_TARGETS.includes(input.target)) {
            return generateError(input.gen, `Unsupported target '${input.target}'. Supported: ${SUPPORTED_TARGETS.join(', ')}`);
          }
          let ast: Record<string, unknown>;
          try {
            ast = JSON.parse(input.themeAst) as Record<string, unknown>;
          } catch {
            return generateError(input.gen, 'Theme AST is not valid JSON');
          }
          const themeName = String(ast['name'] ?? input.gen);
          let output: string;
          switch (input.target) {
            case 'css': output = generateCss(themeName, ast); break;
            case 'scss': output = generateScss(themeName, ast); break;
            case 'tailwind': output = generateTailwind(themeName, ast); break;
            case 'json': output = generateJson(themeName, ast); break;
            default: output = generateCss(themeName, ast); break;
          }
          // Cache the generated output
          await storage.put('theme_gen', `${input.gen}::${input.target}`, {
            gen: input.gen,
            target: input.target,
            output,
            generatedAt: new Date().toISOString(),
          });
          return generateOk(input.gen, output);
        },
        toError,
      ),
    ),
};
