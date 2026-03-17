// ============================================================
// ThemeImplementationEntity diffFromSpec Tests — Monadic
//
// Tests for comparing generated theme implementations against
// theme specs via the StorageProgram DSL. All operations go
// through the interpreter for full traceability.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { interpret } from '../runtime/interpreter.js';
import { themeDiffFromSpecHandler } from '../handlers/ts/score/theme-diff-from-spec.handler.js';

describe('ThemeImplementationEntity diffFromSpec (Monadic)', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  async function run(program: any) {
    const execResult = await interpret(program, storage);
    return { variant: execResult.variant, ...execResult.output };
  }

  // Helper: seed a theme entity
  async function seedTheme(name: string, opts: {
    palette?: Record<string, string>;
    colorRoles?: Record<string, string>;
    typography?: Record<string, string>;
    motion?: Record<string, string>;
    elevation?: Record<string, string>;
    radius?: Record<string, string>;
  } = {}) {
    await storage.put('theme-entity', `theme:${name}`, {
      id: `theme:${name}`,
      name,
      paletteColors: JSON.stringify(opts.palette || {}),
      colorRoles: JSON.stringify(opts.colorRoles || {}),
      typographyStyles: JSON.stringify(opts.typography || {}),
      motionCurves: JSON.stringify(opts.motion || {}),
      elevationLevels: JSON.stringify(opts.elevation || {}),
      radiusValues: JSON.stringify(opts.radius || {}),
    });
  }

  // Helper: seed a theme implementation
  async function seedImpl(id: string, theme: string, tokens: Array<{ path: string; resolvedValue: string }> = []) {
    await storage.put('theme-implementations', `impl:${id}`, {
      id,
      theme,
      platform: 'css',
      tokenPaths: JSON.stringify(tokens),
      tokenCount: tokens.length,
    });
  }

  // ----------------------------------------------------------
  // In-sync case
  // ----------------------------------------------------------

  describe('inSync', () => {
    it('reports inSync when all spec tokens are present in impl with matching values', async () => {
      await seedTheme('ocean', {
        palette: { primary: '#3b82f6', secondary: '#6366f1' },
        radius: { sm: '4px', md: '8px' },
      });
      await seedImpl('impl-1', 'ocean', [
        { path: 'palette.primary', resolvedValue: '#3b82f6' },
        { path: 'palette.secondary', resolvedValue: '#6366f1' },
        { path: 'radius.sm', resolvedValue: '4px' },
        { path: 'radius.md', resolvedValue: '8px' },
      ]);

      const result = await run(themeDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-1',
      }));

      expect(result.variant).toBe('inSync');
    });

    it('returns inSync for nonexistent impl', async () => {
      const result = await run(themeDiffFromSpecHandler.diffFromSpec({
        impl: 'does-not-exist',
      }));

      expect(result.variant).toBe('inSync');
    });
  });

  // ----------------------------------------------------------
  // Missing tokens
  // ----------------------------------------------------------

  describe('missing tokens', () => {
    it('detects tokens in spec but missing from implementation', async () => {
      await seedTheme('forest', {
        palette: { primary: '#22c55e', secondary: '#16a34a', accent: '#f59e0b' },
      });
      await seedImpl('impl-2', 'forest', [
        { path: 'palette.primary', resolvedValue: '#22c55e' },
      ]);

      const result = await run(themeDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-2',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const missing = diffs.filter((d: any) => d.kind === 'missing_token');
      expect(missing).toHaveLength(2);
      expect(missing.map((d: any) => d.token)).toContain('palette.secondary');
      expect(missing.map((d: any) => d.token)).toContain('palette.accent');
      expect(result.missing_tokens).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // Stale values
  // ----------------------------------------------------------

  describe('stale values', () => {
    it('detects tokens where impl value differs from spec value', async () => {
      await seedTheme('sunset', {
        palette: { primary: '#ef4444', secondary: '#f97316' },
      });
      await seedImpl('impl-3', 'sunset', [
        { path: 'palette.primary', resolvedValue: '#ef4444' },
        { path: 'palette.secondary', resolvedValue: '#old-stale-value' },
      ]);

      const result = await run(themeDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-3',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const stale = diffs.filter((d: any) => d.kind === 'stale_value');
      expect(stale).toHaveLength(1);
      expect(stale[0].token).toBe('palette.secondary');
      expect(stale[0].specValue).toBe('#f97316');
      expect(stale[0].implValue).toBe('#old-stale-value');
      expect(result.stale_values).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // Extra tokens
  // ----------------------------------------------------------

  describe('extra tokens', () => {
    it('detects tokens in impl that are not in spec', async () => {
      await seedTheme('minimal', {
        palette: { primary: '#000000' },
      });
      await seedImpl('impl-4', 'minimal', [
        { path: 'palette.primary', resolvedValue: '#000000' },
        { path: 'palette.danger', resolvedValue: '#ff0000' },
        { path: 'custom.brand', resolvedValue: '#abcdef' },
      ]);

      const result = await run(themeDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-4',
      }));

      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      const extra = diffs.filter((d: any) => d.kind === 'extra_token');
      expect(extra).toHaveLength(2);
      expect(result.extra_tokens).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // Mixed drift
  // ----------------------------------------------------------

  describe('mixed drift', () => {
    it('detects missing, stale, and extra tokens simultaneously', async () => {
      await seedTheme('mixed', {
        palette: { primary: '#111', secondary: '#222', tertiary: '#333' },
        radius: { sm: '2px', lg: '16px' },
      });
      await seedImpl('impl-5', 'mixed', [
        { path: 'palette.primary', resolvedValue: '#111' },         // match
        { path: 'palette.secondary', resolvedValue: '#old' },       // stale
        // palette.tertiary missing
        { path: 'radius.sm', resolvedValue: '2px' },                // match
        // radius.lg missing
        { path: 'custom.extra', resolvedValue: 'bonus' },           // extra
      ]);

      const result = await run(themeDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-5',
      }));

      expect(result.variant).toBe('ok');
      expect(result.missing_tokens).toBe(2);   // tertiary, lg
      expect(result.stale_values).toBe(1);      // secondary
      expect(result.extra_tokens).toBe(1);       // custom.extra
      expect(result.total_differences).toBe(4);
    });
  });

  // ----------------------------------------------------------
  // Multi-category tokens
  // ----------------------------------------------------------

  describe('multi-category', () => {
    it('compares tokens across all theme categories', async () => {
      await seedTheme('full', {
        palette: { bg: '#fff' },
        colorRoles: { text: '#000' },
        typography: { body: '16px' },
        motion: { fast: '100ms' },
        elevation: { low: '0 1px 2px' },
        radius: { pill: '9999px' },
      });
      await seedImpl('impl-6', 'full', [
        { path: 'palette.bg', resolvedValue: '#fff' },
        { path: 'color.text', resolvedValue: '#000' },
        { path: 'typography.body', resolvedValue: '16px' },
        { path: 'motion.fast', resolvedValue: '100ms' },
        { path: 'elevation.low', resolvedValue: '0 1px 2px' },
        { path: 'radius.pill', resolvedValue: '9999px' },
      ]);

      const result = await run(themeDiffFromSpecHandler.diffFromSpec({
        impl: 'impl-6',
      }));

      expect(result.variant).toBe('inSync');
    });
  });
});
