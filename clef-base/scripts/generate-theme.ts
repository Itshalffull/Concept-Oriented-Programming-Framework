/**
 * Theme CSS Generation Script
 *
 * Runs the ThemeParser → ThemeGen pipeline to produce CSS custom properties
 * from .theme spec files. Uses the actual Clef concepts (not hand-written CSS).
 *
 * Usage: npx tsx scripts/generate-theme.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseThemeFile } from '../../handlers/ts/framework/theme-spec-parser.js';
import { themeGenHandler } from '../../handlers/ts/app/theme-gen.handler.js';
import { themeParserHandler } from '../../handlers/ts/app/theme-parser.handler.js';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

// Theme files to process
const themes = [
  { name: 'light', kind: 'legacy' as const, path: resolve(repoRoot, 'repertoire/themes/light.theme') },
  { name: 'dark', kind: 'legacy' as const, path: resolve(repoRoot, 'repertoire/themes/dark.theme') },
  { name: 'high-contrast', kind: 'legacy' as const, path: resolve(repoRoot, 'repertoire/themes/high-contrast.theme') },
  { name: 'editorial', kind: 'expressive' as const, path: resolve(repoRoot, 'clef-base/themes/editorial.theme.json') },
  { name: 'signal', kind: 'expressive' as const, path: resolve(repoRoot, 'clef-base/themes/signal.theme.json') },
];

/**
 * Flatten a ThemeManifest into a single flat key→value map
 * with section prefixes (palette-, typography-, spacing-, etc.)
 */
function flattenManifest(manifest: ReturnType<typeof parseThemeFile>): Record<string, string> {
  const flat: Record<string, string> = {};

  // Palette tokens
  for (const [key, value] of Object.entries(manifest.palette)) {
    flat[`palette-${key}`] = value;
  }

  // Typography tokens
  for (const [key, value] of Object.entries(manifest.typography)) {
    if (typeof value === 'string') {
      flat[`typography-${key}`] = value;
    } else {
      flat[`typography-${key}`] = String(value);
    }
  }

  // Spacing tokens
  if (manifest.spacing.unit) {
    flat['spacing-base'] = manifest.spacing.unit;
  }
  for (const [key, value] of Object.entries(manifest.spacing.scale)) {
    flat[`spacing-${key}`] = value;
  }

  // Motion tokens
  for (const [key, value] of Object.entries(manifest.motion)) {
    if (typeof value === 'string') {
      flat[`motion-${key}`] = value;
    } else {
      flat[`motion-${key}`] = String(value);
    }
  }

  // Elevation tokens
  for (const [key, value] of Object.entries(manifest.elevation)) {
    if (typeof value === 'string') {
      flat[`elevation-${key}`] = value;
    } else {
      flat[`elevation-${key}`] = String(value);
    }
  }

  // Radius tokens
  for (const [key, value] of Object.entries(manifest.radius)) {
    flat[`radius-${key}`] = value;
  }

  return flat;
}

async function main() {
  const storage = createInMemoryStorage();
  const outDir = resolve(__dirname, '..', 'app', 'styles');
  mkdirSync(outDir, { recursive: true });

  // First parse the base (light) theme to get inherited values
  const lightSource = readFileSync(themes[0].path, 'utf-8');
  const lightManifest = parseThemeFile(lightSource);
  const lightFlat = flattenManifest(lightManifest);

  const bundle: string[] = [];

  for (const theme of themes) {
    console.log(`Processing ${theme.name}...`);
    let flat: Record<string, string>;
    let context: Record<string, string> = {};

    if (theme.kind === 'legacy') {
      const source = readFileSync(theme.path, 'utf-8');
      const manifest = parseThemeFile(source);
      if (manifest.extends === 'light' && theme.name !== 'light') {
        flat = { ...lightFlat, ...flattenManifest(manifest) };
      } else {
        flat = flattenManifest(manifest);
      }
    } else {
      const source = readFileSync(theme.path, 'utf-8');
      const parsed = await themeParserHandler.parse({ theme: theme.name, source }, storage);
      if (parsed.variant !== 'ok') {
        throw new Error(`Failed to parse expressive theme "${theme.name}"`);
      }
      const ast = JSON.parse(parsed.ast as string) as {
        context?: Record<string, string>;
        tokens?: Record<string, string>;
        raw?: Record<string, unknown>;
      };
      context = Object.fromEntries(
        Object.entries(ast.context ?? {}).map(([key, value]) => [key, String(value)]),
      );
      const activeMode = context.mode ?? String(ast.tokens?.['theme.mode'] ?? 'light');
      const base = activeMode === 'dark'
        ? { ...lightFlat, ...flattenManifest(parseThemeFile(readFileSync(themes[1]!.path, 'utf-8'))) }
        : { ...lightFlat };
      flat = {
        ...base,
        ...mapExpressiveTokens(ast.tokens ?? {}, ast.raw ?? {}),
      };
    }

    // Run ThemeGen with css-variables target
    const result = await themeGenHandler.generate(
      {
        gen: `theme-${theme.name}`,
        target: 'css-variables',
        themeAst: JSON.stringify({ tokens: flat, context }),
      },
      storage,
    );

    if (result.variant === 'ok') {
      let css = result.output as string;
      css = scopeThemeCss(theme.name, css);

      const outPath = resolve(outDir, `${theme.name}.css`);
      writeFileSync(outPath, css, 'utf-8');
      bundle.push(css);
      console.log(`  → ${outPath}`);
    } else {
      console.error(`  Error generating ${theme.name}:`, result.message);
    }
  }

  writeFileSync(resolve(outDir, 'themes.generated.css'), bundle.join('\n\n'), 'utf-8');

  console.log('Done.');
}

function scopeThemeCss(themeName: string, css: string) {
  if (themeName === 'light') {
    return css.replace(':root', ':root, [data-theme="light"]');
  }
  return css.replace(':root', `[data-theme="${themeName}"]`);
}

function mapExpressiveTokens(
  tokens: Record<string, string>,
  raw: Record<string, unknown>,
): Record<string, string> {
  const mapped: Record<string, string> = {};

  const directMap: Record<string, string[]> = {
    'color.primary': ['palette-primary'],
    'color.onPrimary': ['palette-on-primary'],
    'color.surface': ['palette-surface', 'palette-surface-variant'],
    'color.background': ['palette-background'],
    'color.foreground': ['palette-on-background', 'palette-on-surface', 'palette-on-surface-variant'],
    'typography.body': ['typography-body-md-size', 'typography-body-sm-size'],
    'typography.heading': ['typography-heading-md-size', 'typography-heading-sm-size'],
    'radius.md': ['radius-md', 'radius-radius-button', 'radius-radius-input'],
  };

  for (const [source, targets] of Object.entries(directMap)) {
    const value = tokens[source];
    if (!value) continue;
    for (const target of targets) {
      mapped[target] = value;
    }
  }

  const fontMetrics = raw.fontMetrics as Record<string, unknown> | undefined;
  if (typeof fontMetrics?.family === 'string' && fontMetrics.family.trim()) {
    mapped['typography-font-family-sans'] = fontMetrics.family;
  }

  const shape = raw.shape as Record<string, unknown> | undefined;
  if (typeof shape?.radius === 'string' && shape.radius.trim()) {
    mapped['radius-md'] = shape.radius;
    mapped['radius-radius-button'] = shape.radius;
    mapped['radius-radius-input'] = shape.radius;
  }

  if (tokens['density.multiplier']) {
    mapped['spacing-page-inline'] = tokens['density.multiplier'] === '1'
      ? mapped['spacing-page-inline'] ?? '24px'
      : '20px';
  }

  return mapped;
}

main().catch(console.error);
