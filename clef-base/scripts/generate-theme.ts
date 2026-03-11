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
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

// Theme files to process
const themes = [
  { name: 'light', path: resolve(repoRoot, 'repertoire/themes/light.theme') },
  { name: 'dark', path: resolve(repoRoot, 'repertoire/themes/dark.theme') },
  { name: 'high-contrast', path: resolve(repoRoot, 'repertoire/themes/high-contrast.theme') },
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

  for (const theme of themes) {
    console.log(`Processing ${theme.name}...`);
    const source = readFileSync(theme.path, 'utf-8');
    const manifest = parseThemeFile(source);

    // For themes that extend light, merge with light's tokens
    let flat: Record<string, string>;
    if (manifest.extends === 'light' && theme.name !== 'light') {
      flat = { ...lightFlat, ...flattenManifest(manifest) };
    } else {
      flat = flattenManifest(manifest);
    }

    // Run ThemeGen with css-variables target
    const result = await themeGenHandler.generate(
      { gen: `theme-${theme.name}`, target: 'css-variables', themeAst: JSON.stringify(flat) },
      storage,
    );

    if (result.variant === 'ok') {
      // For dark theme, scope to [data-theme="dark"] instead of :root
      let css = result.output as string;
      if (theme.name === 'dark') {
        css = css.replace(':root', '[data-theme="dark"]');
      } else if (theme.name === 'high-contrast') {
        css = css.replace(':root', '[data-theme="high-contrast"]');
      }

      const outPath = resolve(outDir, `${theme.name}.css`);
      writeFileSync(outPath, css, 'utf-8');
      console.log(`  → ${outPath}`);
    } else {
      console.error(`  Error generating ${theme.name}:`, result.message);
    }
  }

  console.log('Done.');
}

main().catch(console.error);
