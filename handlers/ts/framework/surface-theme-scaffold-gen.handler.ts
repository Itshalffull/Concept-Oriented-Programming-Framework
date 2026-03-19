// @migrated dsl-constructs 2026-03-18
// ============================================================
// SurfaceThemeScaffoldGen — Clef Surface theme scaffold generator
// See Clef Surface architecture: surface-theme suite
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function toKebab(name: string): string { return name.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase(); }

interface ThemeConfig { name: string; primaryColor?: string; secondaryColor?: string; fontFamily?: string; baseSize?: number; scale?: number; borderRadius?: string; mode?: 'light' | 'dark' | 'both'; }

function buildExpressiveThemeSpec(config: ThemeConfig): string {
  const primaryHue = config.primaryColor || '220';
  return `{\n  "name": "${toKebab(config.name)}",\n  "colorSpace": { "algorithm": "oklch" }\n}\n`;
}

function buildThemeJson(config: ThemeConfig, mode: 'light' | 'dark'): string {
  return JSON.stringify({ name: `${config.name}-${mode}`, mode, tokens: { colors: { primary: config.primaryColor || '#3b82f6', background: mode === 'light' ? '#ffffff' : '#111827' } } }, null, 2) + '\n';
}

function buildPaletteConfig(config: ThemeConfig): string { return JSON.stringify({ palettes: { primary: { seed: config.primaryColor || '220' } } }, null, 2) + '\n'; }
function buildTypographyConfig(config: ThemeConfig): string { return JSON.stringify({ fontFamilies: { sans: config.fontFamily || 'system-ui, sans-serif' }, scale: { ratio: config.scale || 1.25, base: `${config.baseSize || 16}px` } }, null, 2) + '\n'; }
function buildMotionConfig(): string { return JSON.stringify({ durations: { fast: '100ms', normal: '200ms', slow: '300ms' } }, null, 2) + '\n'; }
function buildElevationConfig(): string { return JSON.stringify({ scale: { 0: { shadow: 'none' }, 1: { shadow: '0 1px 2px 0 rgba(0,0,0,0.05)' } } }, null, 2) + '\n'; }
function buildThemeSuiteYaml(config: ThemeConfig): string { const kebab = toKebab(config.name); return ['suite:', `  name: theme-${kebab}`, '  version: 0.1.0', '  description: >', `    ${config.name} design system theme.`, '', 'dependencies:', '  - surface-core: ">=0.1.0"', '  - surface-theme: ">=0.1.0"', ''].join('\n'); }

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'SurfaceThemeScaffoldGen', inputKind: 'ThemeConfig', outputKind: 'SurfaceTheme', capabilities: JSON.stringify(['palette', 'typography', 'spacing', 'motion', 'elevation', 'radius', 'extends', 'wcag']) }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const name = (input.name as string) || 'my-theme';
    if (!name || typeof name !== 'string') { const p = createProgram(); return complete(p, 'error', { message: 'Theme name is required' }) as StorageProgram<Result>; }
    try {
      const kebab = toKebab(name);
      const config: ThemeConfig = { name, primaryColor: input.primaryColor as string, secondaryColor: input.secondaryColor as string, fontFamily: input.fontFamily as string, baseSize: input.baseSize as number, scale: input.scale as number, borderRadius: input.borderRadius as string, mode: (input.mode as ThemeConfig['mode']) || 'both' };
      const files: { path: string; content: string }[] = [{ path: `theme-${kebab}/suite.stub.yaml`, content: buildThemeSuiteYaml(config) }, { path: `theme-${kebab}/themes/${kebab}.stub.theme.json`, content: buildExpressiveThemeSpec(config) }];
      if (config.mode === 'both' || config.mode === 'light') files.push({ path: `theme-${kebab}/themes/${kebab}-light.stub.json`, content: buildThemeJson(config, 'light') });
      if (config.mode === 'both' || config.mode === 'dark') files.push({ path: `theme-${kebab}/themes/${kebab}-dark.stub.json`, content: buildThemeJson(config, 'dark') });
      files.push({ path: `theme-${kebab}/tokens/palette.stub.json`, content: buildPaletteConfig(config) }, { path: `theme-${kebab}/tokens/typography.stub.json`, content: buildTypographyConfig(config) }, { path: `theme-${kebab}/tokens/motion.stub.json`, content: buildMotionConfig() }, { path: `theme-${kebab}/tokens/elevation.stub.json`, content: buildElevationConfig() });
      const p = createProgram();
      return complete(p, 'ok', { files, filesGenerated: files.length }) as StorageProgram<Result>;
    } catch (err: unknown) { const message = err instanceof Error ? err.message : String(err); const p = createProgram(); return complete(p, 'error', { message }) as StorageProgram<Result>; }
  },

  preview(input: Record<string, unknown>) { return _handler.generate(input); },
};

export const surfaceThemeScaffoldGenHandler = autoInterpret(_handler);
