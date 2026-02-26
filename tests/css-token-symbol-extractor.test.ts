// ============================================================
// CssTokenSymbolExtractor Handler Tests
//
// Tests for extracting symbols from CSS files: custom properties,
// class selectors, keyframes, media queries, and var() references.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  cssTokenSymbolExtractorHandler,
  resetCssTokenSymbolExtractorCounter,
} from '../handlers/ts/css-token-symbol-extractor.handler.js';

describe('CssTokenSymbolExtractor', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetCssTokenSymbolExtractorCounter();
  });

  // ── initialize ────────────────────────────────────────────

  describe('initialize', () => {
    it('initializes and returns ok with an instance id', async () => {
      const result = await cssTokenSymbolExtractorHandler.initialize({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('css-token-symbol-extractor-1');
    });
  });

  // ── extract ───────────────────────────────────────────────

  describe('extract', () => {
    it('extracts CSS custom property definitions', async () => {
      const source = `:root {
  --primary-color: #3498db;
  --secondary-color: #2ecc71;
  --font-size-base: 16px;
}`;
      const result = await cssTokenSymbolExtractorHandler.extract({
        source, file: 'tokens.css',
      }, storage);

      expect(result.variant).toBe('ok');
      const symbols = JSON.parse(result.symbols as string);
      const customProps = symbols.filter((s: Record<string, string>) => s.role === 'definition' && s.displayName.startsWith('--'));
      expect(customProps).toHaveLength(3);
      expect(customProps[0].symbolString).toBe('css/custom-property/tokens.css/--primary-color');
      expect(customProps[0].kind).toBe('variable');
    });

    it('extracts class selectors', async () => {
      const source = `.btn {
  padding: 8px;
}
.card {
  border: 1px solid;
}`;
      const result = await cssTokenSymbolExtractorHandler.extract({
        source, file: 'components.css',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const classes = symbols.filter((s: Record<string, string>) => s.kind === 'class');
      expect(classes).toHaveLength(2);
      expect(classes[0].displayName).toBe('.btn');
      expect(classes[1].displayName).toBe('.card');
    });

    it('skips pseudo-class keywords', async () => {
      const source = `.btn:hover {
  color: red;
}
.link:focus {
  outline: 2px solid blue;
}`;
      const result = await cssTokenSymbolExtractorHandler.extract({
        source, file: 'states.css',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const classes = symbols.filter((s: Record<string, string>) => s.kind === 'class');
      // Should extract .btn and .link but not hover or focus
      const classNames = classes.map((c: Record<string, string>) => c.displayName);
      expect(classNames).not.toContain('.hover');
      expect(classNames).not.toContain('.focus');
    });

    it('extracts @keyframes names', async () => {
      const source = `@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slide-up {
  0% { transform: translateY(100%); }
  100% { transform: translateY(0); }
}`;
      const result = await cssTokenSymbolExtractorHandler.extract({
        source, file: 'animations.css',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const keyframes = symbols.filter((s: Record<string, string>) => s.displayName.startsWith('@keyframes'));
      expect(keyframes).toHaveLength(2);
      expect(keyframes[0].symbolString).toBe('css/keyframes/animations.css/fadeIn');
      expect(keyframes[0].kind).toBe('function');
    });

    it('extracts var() references', async () => {
      const source = `.btn {
  color: var(--primary-color);
  font-size: var(--font-size-base, 14px);
}`;
      const result = await cssTokenSymbolExtractorHandler.extract({
        source, file: 'components.css',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const varRefs = symbols.filter((s: Record<string, string>) => s.role === 'reference');
      expect(varRefs).toHaveLength(2);
      expect(varRefs[0].symbolString).toBe('css/custom-property-ref/--primary-color');
      expect(varRefs[0].displayName).toBe('var(--primary-color)');
    });

    it('returns empty symbols for empty CSS', async () => {
      const result = await cssTokenSymbolExtractorHandler.extract({
        source: '', file: 'empty.css',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      expect(symbols).toHaveLength(0);
    });

    it('handles mixed CSS content', async () => {
      const source = `:root {
  --spacing-sm: 4px;
}
.container {
  padding: var(--spacing-sm);
}
@keyframes spin {
  100% { transform: rotate(360deg); }
}`;
      const result = await cssTokenSymbolExtractorHandler.extract({
        source, file: 'mixed.css',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const definitions = symbols.filter((s: Record<string, string>) => s.role === 'definition');
      const references = symbols.filter((s: Record<string, string>) => s.role === 'reference');
      expect(definitions.length).toBeGreaterThanOrEqual(3); // custom prop + class + keyframes
      expect(references.length).toBeGreaterThanOrEqual(1); // var() ref
    });
  });

  // ── getSupportedExtensions ────────────────────────────────

  describe('getSupportedExtensions', () => {
    it('returns .css extension', async () => {
      const result = await cssTokenSymbolExtractorHandler.getSupportedExtensions({}, storage);
      expect(result.variant).toBe('ok');
      const extensions = JSON.parse(result.extensions as string);
      expect(extensions).toContain('.css');
    });
  });
});
