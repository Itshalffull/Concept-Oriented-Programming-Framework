/**
 * ThemeRealizer end-to-end realize tests.
 *
 * Tests the realize action flow: register a realizer, then realize
 * contracts against a theme, and verify both the CSS and manifest
 * artifacts produced by the CSS generator.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { interpret } from '../runtime/interpreter.js';
import { themeRealizerHandler, generateContractCSS, generateContractManifest } from '../handlers/ts/surface/theme-realizer.handler.js';

describe('ThemeRealizer realize end-to-end', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  async function registerCssRealizer() {
    const result = await interpret(
      themeRealizerHandler.register({
        realizer: 'realizer-css',
        target: 'web-css',
        outputKinds: ['ContractManifest', 'ContractCss'],
        contractSupport: ['field-control', 'floating-panel', 'menu-item'],
        capabilities: ['density-variants', 'state-selectors'],
        description: 'Generate contract CSS and manifest output for web targets.',
      }),
      storage,
    );
    expect(result.variant).toBe('ok');
    return result;
  }

  describe('realize action', () => {
    it('produces ok variant with output and manifest fields after register', async () => {
      await registerCssRealizer();

      const contracts = JSON.stringify({
        contracts: [
          { id: 'field-control', states: ['focus', 'invalid'] },
          { id: 'floating-panel' },
        ],
      });
      const theme = JSON.stringify({ id: 'light' });

      const result = await interpret(
        themeRealizerHandler.realize({
          realizer: 'realizer-css',
          theme,
          contracts,
          lenses: '{"lenses":[]}',
          context: '{"density":"compact"}',
        }),
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.output?.realizer ?? (result as any).realizer).toBe('realizer-css');
      // Both CSS and manifest should be non-empty strings
      const css = (result.output?.output ?? (result as any).output) as string;
      const manifest = (result.output?.manifest ?? (result as any).manifest) as string;
      expect(typeof css).toBe('string');
      expect(css.length).toBeGreaterThan(0);
      expect(typeof manifest).toBe('string');
      expect(manifest.length).toBeGreaterThan(0);
    });

    it('returns notfound for an unregistered realizer', async () => {
      await registerCssRealizer();

      const result = await interpret(
        themeRealizerHandler.realize({
          realizer: 'nonexistent-realizer',
          theme: '{"id":"light"}',
          contracts: '{"contracts":[]}',
          lenses: '{"lenses":[]}',
          context: '{}',
        }),
        storage,
      );

      expect(result.variant).toBe('notfound');
    });

    it('returns error for empty theme string', async () => {
      await registerCssRealizer();

      const result = await interpret(
        themeRealizerHandler.realize({
          realizer: 'realizer-css',
          theme: '',
          contracts: '{"contracts":[]}',
          lenses: '{"lenses":[]}',
          context: '{}',
        }),
        storage,
      );

      expect(result.variant).toBe('error');
    });
  });

  describe('CSS generator', () => {
    const theme = { id: 'light' };

    it('generates theme-scoped CSS variable block', () => {
      const css = generateContractCSS([], theme);
      expect(css).toContain('[data-theme="light"]');
      expect(css).toContain('--palette-surface');
      expect(css).toContain('--palette-foreground');
    });

    it('generates base contract selector for field-control', () => {
      const contracts = [{ id: 'field-control', states: ['focus', 'invalid'] }];
      const css = generateContractCSS(contracts, theme);
      expect(css).toContain('[data-contract="field-control"]');
      expect(css).toContain('--sc-field-control-background');
      expect(css).toContain('--sc-field-control-border');
    });

    it('generates state selectors using data-contract-state~ attribute', () => {
      const contracts = [{ id: 'field-control', states: ['focus', 'invalid'] }];
      const css = generateContractCSS(contracts, theme);
      // State rules follow PRD §3.8 data-attribute convention
      expect(css).toContain('[data-contract="field-control"][data-contract-state~="focus"]');
      expect(css).toContain('[data-contract="field-control"][data-contract-state~="invalid"]');
    });

    it('generates invalid state with border-color override', () => {
      const contracts = [{ id: 'field-control', states: ['invalid'] }];
      const css = generateContractCSS(contracts, theme);
      const invalidBlock = css.split('[data-contract="field-control"][data-contract-state~="invalid"]')[1];
      expect(invalidBlock).toBeDefined();
      expect(invalidBlock).toContain('border-color');
      expect(invalidBlock).toContain('--sc-field-control-border-invalid');
    });

    it('generates focus state with outline', () => {
      const contracts = [{ id: 'field-control', states: ['focus'] }];
      const css = generateContractCSS(contracts, theme);
      const focusBlock = css.split('[data-contract="field-control"][data-contract-state~="focus"]')[1];
      expect(focusBlock).toContain('outline');
    });

    it('generates base rules for floating-panel', () => {
      const contracts = [{ id: 'floating-panel' }];
      const css = generateContractCSS(contracts, theme);
      expect(css).toContain('[data-contract="floating-panel"]');
      expect(css).toContain('box-shadow');
      expect(css).toContain('--sc-floating-panel-shadow');
    });

    it('generates base rules for menu-item', () => {
      const contracts = [{ id: 'menu-item' }];
      const css = generateContractCSS(contracts, theme);
      expect(css).toContain('[data-contract="menu-item"]');
      expect(css).toContain('padding');
    });

    it('generates variant selectors using data-contract-variant attribute', () => {
      const contracts = [{ id: 'field-control', states: [], variants: ['compact', 'comfortable'] }];
      const css = generateContractCSS(contracts, theme);
      expect(css).toContain('[data-contract="field-control"][data-contract-variant="compact"]');
      expect(css).toContain('[data-contract="field-control"][data-contract-variant="comfortable"]');
    });

    it('generates multiple contracts in one pass', () => {
      const contracts = [
        { id: 'field-control', states: ['focus'] },
        { id: 'floating-panel' },
        { id: 'menu-item', states: ['hover', 'selected'] },
      ];
      const css = generateContractCSS(contracts, theme);
      expect(css).toContain('[data-contract="field-control"]');
      expect(css).toContain('[data-contract="floating-panel"]');
      expect(css).toContain('[data-contract="menu-item"]');
      expect(css).toContain('[data-contract="menu-item"][data-contract-state~="selected"]');
    });

    it('includes custom theme tokens when provided', () => {
      const customTheme = {
        id: 'dark',
        tokens: { 'palette-surface': '#1a1a1a', 'palette-foreground': '#f0f0f0' },
      };
      const css = generateContractCSS([], customTheme);
      expect(css).toContain('[data-theme="dark"]');
      expect(css).toContain('--palette-surface: #1a1a1a');
      expect(css).toContain('--palette-foreground: #f0f0f0');
    });
  });

  describe('Manifest generator', () => {
    const theme = { id: 'light' };

    it('produces valid JSON that parses correctly', () => {
      const contracts = [{ id: 'field-control', states: ['focus', 'invalid'] }];
      const manifestJson = generateContractManifest('realizer-css', 'web-css', contracts, theme);
      // Should be an object, not a string
      expect(typeof manifestJson).toBe('object');
      expect(manifestJson.themeId).toBe('light');
    });

    it('includes all expected top-level fields', () => {
      const contracts = [{ id: 'field-control' }];
      const manifest = generateContractManifest('realizer-css', 'web-css', contracts, theme);

      expect(manifest.themeId).toBe('light');
      expect(manifest.realizerId).toBe('realizer-css');
      expect(manifest.target).toBe('web-css');
      expect(manifest.generatedAt).toBeDefined();
      expect(Array.isArray(manifest.contracts)).toBe(true);
    });

    it('includes all contracts in the manifest', () => {
      const contracts = [
        { id: 'field-control' },
        { id: 'floating-panel' },
        { id: 'menu-item' },
      ];
      const manifest = generateContractManifest('realizer-css', 'web-css', contracts, theme);
      expect(manifest.contracts.length).toBe(3);
      const ids = manifest.contracts.map((c) => c.id);
      expect(ids).toContain('field-control');
      expect(ids).toContain('floating-panel');
      expect(ids).toContain('menu-item');
    });

    it('includes resolved state variants per contract', () => {
      const contracts = [{ id: 'field-control', states: ['focus', 'invalid', 'disabled'] }];
      const manifest = generateContractManifest('realizer-css', 'web-css', contracts, theme);
      const fc = manifest.contracts.find((c) => c.id === 'field-control')!;
      expect(fc.states).toContain('focus');
      expect(fc.states).toContain('invalid');
      expect(fc.states).toContain('disabled');
    });

    it('includes base selector for each contract', () => {
      const contracts = [{ id: 'field-control' }];
      const manifest = generateContractManifest('realizer-css', 'web-css', contracts, theme);
      const fc = manifest.contracts[0];
      expect(fc.selectors.base).toBe('[data-contract="field-control"]');
    });

    it('includes state selectors for each state', () => {
      const contracts = [{ id: 'field-control', states: ['focus', 'invalid'] }];
      const manifest = generateContractManifest('realizer-css', 'web-css', contracts, theme);
      const fc = manifest.contracts[0];
      expect(fc.selectors.states.focus).toBe('[data-contract="field-control"][data-contract-state~="focus"]');
      expect(fc.selectors.states.invalid).toBe('[data-contract="field-control"][data-contract-state~="invalid"]');
    });

    it('includes variant selectors when variants are declared', () => {
      const contracts = [{ id: 'field-control', states: [], variants: ['compact'] }];
      const manifest = generateContractManifest('realizer-css', 'web-css', contracts, theme);
      const fc = manifest.contracts[0];
      expect(fc.selectors.variants.compact).toBe('[data-contract="field-control"][data-contract-variant="compact"]');
    });

    it('includes semantic resource bindings', () => {
      const contracts = [{ id: 'field-control' }];
      const manifest = generateContractManifest('realizer-css', 'web-css', contracts, theme);
      const fc = manifest.contracts[0];
      expect(Object.keys(fc.resources).length).toBeGreaterThan(0);
      // field-control should have at least background and foreground resources
      expect(fc.resources.background).toBeDefined();
      expect(fc.resources.foreground).toBeDefined();
    });

    it('manifest JSON from realize action is parseable', async () => {
      await registerCssRealizer();

      const contractsInput = JSON.stringify({
        contracts: [{ id: 'field-control', states: ['focus', 'invalid'] }],
      });

      const result = await interpret(
        themeRealizerHandler.realize({
          realizer: 'realizer-css',
          theme: '{"id":"light"}',
          contracts: contractsInput,
          lenses: '{"lenses":[]}',
          context: '{}',
        }),
        storage,
      );

      expect(result.variant).toBe('ok');
      const manifestStr = (result.output?.manifest ?? (result as any).manifest) as string;
      const manifest = JSON.parse(manifestStr) as Record<string, unknown>;
      expect(manifest.themeId).toBe('light');
      expect(manifest.realizerId).toBe('realizer-css');
      expect(Array.isArray(manifest.contracts)).toBe(true);
      const contracts = manifest.contracts as Array<Record<string, unknown>>;
      expect(contracts.length).toBe(1);
      expect(contracts[0].id).toBe('field-control');
    });

    it('manifest includes selector for all field-control states in end-to-end flow', async () => {
      await registerCssRealizer();

      const contractsInput = JSON.stringify({
        contracts: [{ id: 'field-control', states: ['focus', 'invalid', 'disabled'] }],
      });

      const result = await interpret(
        themeRealizerHandler.realize({
          realizer: 'realizer-css',
          theme: '{"id":"light"}',
          contracts: contractsInput,
          lenses: '{"lenses":[]}',
          context: '{}',
        }),
        storage,
      );

      expect(result.variant).toBe('ok');
      const manifestStr = (result.output?.manifest ?? (result as any).manifest) as string;
      const manifest = JSON.parse(manifestStr) as Record<string, unknown>;
      const contracts = manifest.contracts as Array<Record<string, unknown>>;
      const fc = contracts[0] as Record<string, unknown>;
      const selectors = fc.selectors as Record<string, unknown>;
      const stateSelectors = selectors.states as Record<string, string>;

      expect(stateSelectors.focus).toBe('[data-contract="field-control"][data-contract-state~="focus"]');
      expect(stateSelectors.invalid).toBe('[data-contract="field-control"][data-contract-state~="invalid"]');
      expect(stateSelectors.disabled).toBe('[data-contract="field-control"][data-contract-state~="disabled"]');
    });

    it('CSS output from realize action contains expected selectors', async () => {
      await registerCssRealizer();

      const contractsInput = JSON.stringify({
        contracts: [
          { id: 'field-control', states: ['focus', 'invalid'] },
          { id: 'floating-panel' },
        ],
      });

      const result = await interpret(
        themeRealizerHandler.realize({
          realizer: 'realizer-css',
          theme: '{"id":"light"}',
          contracts: contractsInput,
          lenses: '{"lenses":[]}',
          context: '{}',
        }),
        storage,
      );

      expect(result.variant).toBe('ok');
      const css = (result.output?.output ?? (result as any).output) as string;

      // Theme variables block
      expect(css).toContain('[data-theme="light"]');
      expect(css).toContain('--palette-surface');

      // Base contract rules
      expect(css).toContain('[data-contract="field-control"]');
      expect(css).toContain('[data-contract="floating-panel"]');

      // State rules
      expect(css).toContain('[data-contract="field-control"][data-contract-state~="focus"]');
      expect(css).toContain('[data-contract="field-control"][data-contract-state~="invalid"]');

      // Semantic CSS variables
      expect(css).toContain('--sc-field-control-background');
      expect(css).toContain('--sc-floating-panel-shadow');
    });
  });
});
