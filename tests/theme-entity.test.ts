// ============================================================
// ThemeEntity Handler Tests
//
// Tests for theme-entity: registration, duplicate detection,
// get, token resolution with extends chain, contrast audit,
// theme diffing, affected widgets, and generated outputs.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  themeEntityHandler,
  resetThemeEntityCounter,
} from '../handlers/ts/theme-entity.handler.js';

describe('ThemeEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetThemeEntityCounter();
  });

  // ----------------------------------------------------------
  // register
  // ----------------------------------------------------------

  describe('register', () => {
    it('registers a new theme and returns ok', async () => {
      const result = await themeEntityHandler.register(
        {
          name: 'Light',
          source: 'themes/light.theme',
          ast: JSON.stringify({
            purpose: 'Default light theme',
            palette: { primary: '#0066cc', secondary: '#666' },
            colorRoles: { foreground: '#000', background: '#fff' },
            typography: { body: { size: '16px', weight: '400' } },
            spacing: { unit: '8px' },
          }),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.entity).toBe('theme-entity-1');
    });

    it('extracts metadata from AST', async () => {
      await themeEntityHandler.register(
        {
          name: 'Dark',
          source: 'themes/dark.theme',
          ast: JSON.stringify({
            purpose: 'Dark mode',
            extends: 'Light',
            palette: { primary: '#88ccff' },
            motion: { ease: 'cubic-bezier(0.4,0,0.2,1)' },
            elevation: { low: '2px', high: '8px' },
            radius: { small: '4px' },
          }),
        },
        storage,
      );
      const record = await storage.get('theme-entity', 'theme-entity-1');
      expect(record!.purposeText).toBe('Dark mode');
      expect(record!.extendsTheme).toBe('Light');
      expect(JSON.parse(record!.paletteColors as string)).toEqual({ primary: '#88ccff' });
      expect(JSON.parse(record!.motionCurves as string)).toEqual({ ease: 'cubic-bezier(0.4,0,0.2,1)' });
    });

    it('returns alreadyRegistered for duplicate name', async () => {
      const first = await themeEntityHandler.register(
        { name: 'Light', source: 'a.theme', ast: '{}' },
        storage,
      );
      const second = await themeEntityHandler.register(
        { name: 'Light', source: 'b.theme', ast: '{}' },
        storage,
      );
      expect(second.variant).toBe('alreadyRegistered');
      expect(second.existing).toBe(first.entity);
    });

    it('handles non-JSON AST gracefully', async () => {
      const result = await themeEntityHandler.register(
        { name: 'Broken', source: 'x.theme', ast: 'not-json' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns the theme entity by name', async () => {
      const reg = await themeEntityHandler.register(
        { name: 'Light', source: 'a.theme', ast: '{}' },
        storage,
      );
      const result = await themeEntityHandler.get({ name: 'Light' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.entity).toBe(reg.entity);
    });

    it('returns notfound for unknown name', async () => {
      const result = await themeEntityHandler.get({ name: 'Nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // resolveToken
  // ----------------------------------------------------------

  describe('resolveToken', () => {
    it('resolves a palette token from the current theme', async () => {
      const reg = await themeEntityHandler.register(
        {
          name: 'Light',
          source: 'a.theme',
          ast: JSON.stringify({
            palette: { primary: '#0066cc', secondary: '#666' },
          }),
        },
        storage,
      );

      const result = await themeEntityHandler.resolveToken(
        { theme: reg.entity, tokenPath: 'palette.primary' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.resolvedValue).toBe('#0066cc');
    });

    it('resolves a typography token', async () => {
      const reg = await themeEntityHandler.register(
        {
          name: 'Light',
          source: 'a.theme',
          ast: JSON.stringify({
            typography: { body: { size: '16px', weight: '400' } },
          }),
        },
        storage,
      );

      const result = await themeEntityHandler.resolveToken(
        { theme: reg.entity, tokenPath: 'typography.body' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const parsed = JSON.parse(result.resolvedValue as string);
      expect(parsed.size).toBe('16px');
    });

    it('returns notfound for a nonexistent theme', async () => {
      const result = await themeEntityHandler.resolveToken(
        { theme: 'nope', tokenPath: 'palette.primary' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('returns notfound when the token path does not exist', async () => {
      const reg = await themeEntityHandler.register(
        { name: 'Light', source: 'a.theme', ast: JSON.stringify({ palette: {} }) },
        storage,
      );
      const result = await themeEntityHandler.resolveToken(
        { theme: reg.entity, tokenPath: 'palette.nonexistent' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // contrastAudit
  // ----------------------------------------------------------

  describe('contrastAudit', () => {
    it('returns audit results for color roles', async () => {
      const reg = await themeEntityHandler.register(
        {
          name: 'Light',
          source: 'a.theme',
          ast: JSON.stringify({
            colorRoles: { foreground: '#000', background: '#fff' },
          }),
        },
        storage,
      );

      const result = await themeEntityHandler.contrastAudit({ theme: reg.entity }, storage);
      expect(result.variant).toBe('ok');
      expect(result.allPassing).toBe('true');
      const results = JSON.parse(result.results as string);
      expect(results).toHaveLength(1);
      expect(results[0].rolePair).toBe('foreground/background');
    });

    it('returns empty results for nonexistent theme', async () => {
      const result = await themeEntityHandler.contrastAudit({ theme: 'nope' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.allPassing).toBe('false');
    });
  });

  // ----------------------------------------------------------
  // diffThemes
  // ----------------------------------------------------------

  describe('diffThemes', () => {
    it('returns differences between two themes', async () => {
      const a = await themeEntityHandler.register(
        {
          name: 'Light',
          source: 'a.theme',
          ast: JSON.stringify({
            palette: { primary: '#0066cc', secondary: '#666' },
          }),
        },
        storage,
      );
      const b = await themeEntityHandler.register(
        {
          name: 'Dark',
          source: 'b.theme',
          ast: JSON.stringify({
            palette: { primary: '#88ccff', secondary: '#aaa' },
          }),
        },
        storage,
      );

      const result = await themeEntityHandler.diffThemes(
        { a: a.entity, b: b.entity },
        storage,
      );
      expect(result.variant).toBe('ok');
      const diffs = JSON.parse(result.differences as string);
      expect(diffs.length).toBeGreaterThanOrEqual(2);
    });

    it('returns same when themes are identical', async () => {
      const a = await themeEntityHandler.register(
        {
          name: 'A',
          source: 'a.theme',
          ast: JSON.stringify({ palette: { primary: '#000' } }),
        },
        storage,
      );
      const b = await themeEntityHandler.register(
        {
          name: 'B',
          source: 'b.theme',
          ast: JSON.stringify({ palette: { primary: '#000' } }),
        },
        storage,
      );

      const result = await themeEntityHandler.diffThemes(
        { a: a.entity, b: b.entity },
        storage,
      );
      expect(result.variant).toBe('same');
    });

    it('returns empty differences when one theme is missing', async () => {
      const a = await themeEntityHandler.register(
        { name: 'A', source: 'a.theme', ast: '{}' },
        storage,
      );
      const result = await themeEntityHandler.diffThemes(
        { a: a.entity, b: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.differences).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // affectedWidgets
  // ----------------------------------------------------------

  describe('affectedWidgets', () => {
    it('finds widgets referencing the changed token', async () => {
      const reg = await themeEntityHandler.register(
        { name: 'Light', source: 'a.theme', ast: '{}' },
        storage,
      );

      await storage.put('widget-entity', 'w-1', {
        id: 'w-1',
        name: 'Button',
        ast: JSON.stringify({ connect: { color: '{palette.primary}' } }),
      });
      await storage.put('widget-entity', 'w-2', {
        id: 'w-2',
        name: 'Card',
        ast: JSON.stringify({ connect: { border: '1px solid' } }),
      });

      const result = await themeEntityHandler.affectedWidgets(
        { theme: reg.entity, changedToken: 'palette.primary' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const widgets = JSON.parse(result.widgets as string);
      expect(widgets).toHaveLength(1);
      expect(widgets[0].name).toBe('Button');
    });
  });

  // ----------------------------------------------------------
  // generatedOutputs
  // ----------------------------------------------------------

  describe('generatedOutputs', () => {
    it('returns provenance records for the theme symbol', async () => {
      const reg = await themeEntityHandler.register(
        { name: 'Light', source: 'a.theme', ast: '{}' },
        storage,
      );

      await storage.put('provenance', 'prov-1', {
        id: 'prov-1',
        sourceSymbol: 'clef/theme/Light',
        platform: 'css',
        targetFile: 'generated/light.css',
      });

      const result = await themeEntityHandler.generatedOutputs({ theme: reg.entity }, storage);
      expect(result.variant).toBe('ok');
      const outputs = JSON.parse(result.outputs as string);
      expect(outputs).toHaveLength(1);
      expect(outputs[0].platform).toBe('css');
    });

    it('returns empty for nonexistent theme', async () => {
      const result = await themeEntityHandler.generatedOutputs({ theme: 'nope' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.outputs).toBe('[]');
    });
  });
});
