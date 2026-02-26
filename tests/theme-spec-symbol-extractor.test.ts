// ============================================================
// ThemeSpecSymbolExtractor Handler Tests
//
// Tests for extracting symbols from Clef Surface theme spec files:
// theme names, token definitions, scale values, semantic aliases,
// mode variants, and token references.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  themeSpecSymbolExtractorHandler,
  resetThemeSpecSymbolExtractorCounter,
} from '../handlers/ts/theme-spec-symbol-extractor.handler.js';

describe('ThemeSpecSymbolExtractor', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetThemeSpecSymbolExtractorCounter();
  });

  // ── initialize ────────────────────────────────────────────

  describe('initialize', () => {
    it('initializes and returns ok with an instance id', async () => {
      const result = await themeSpecSymbolExtractorHandler.initialize({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('theme-spec-symbol-extractor-1');
    });
  });

  // ── extract ───────────────────────────────────────────────

  describe('extract', () => {
    it('extracts theme declaration using theme keyword', async () => {
      const source = `theme MyTheme {
  tokens {
  }
}`;
      const result = await themeSpecSymbolExtractorHandler.extract({
        source, file: 'my-theme.theme',
      }, storage);

      expect(result.variant).toBe('ok');
      const symbols = JSON.parse(result.symbols as string);
      const themeDef = symbols.find((s: Record<string, string>) =>
        s.kind === 'concept' && s.role === 'definition'
      );
      expect(themeDef).toBeDefined();
      expect(themeDef.symbolString).toBe('surface/theme/MyTheme');
    });

    it('extracts theme declaration using name: key', async () => {
      const source = `name: dark-theme
tokens {
}`;
      const result = await themeSpecSymbolExtractorHandler.extract({
        source, file: 'dark.theme',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const themeDef = symbols.find((s: Record<string, string>) =>
        s.symbolString === 'surface/theme/dark-theme'
      );
      expect(themeDef).toBeDefined();
    });

    it('extracts token definitions in tokens section', async () => {
      const source = `theme Brand {
tokens {
  primary: #3498db
  secondary: #2ecc71
  accent: #e74c3c
}
}`;
      const result = await themeSpecSymbolExtractorHandler.extract({
        source, file: 'brand.theme',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const tokens = symbols.filter((s: Record<string, string>) =>
        s.symbolString.includes('/token/')
      );
      expect(tokens).toHaveLength(3);
      expect(tokens[0].symbolString).toBe('surface/theme/Brand/token/primary');
      expect(tokens[0].kind).toBe('config-key');
    });

    it('extracts tokens in colors section', async () => {
      const source = `theme MyTheme {
colors {
  red: #ff0000
  blue: #0000ff
}
}`;
      const result = await themeSpecSymbolExtractorHandler.extract({
        source, file: 'colors.theme',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const tokens = symbols.filter((s: Record<string, string>) =>
        s.symbolString.includes('/token/')
      );
      expect(tokens).toHaveLength(2);
    });

    it('extracts scale values', async () => {
      const source = `theme Design {
scale {
  sm: 4px
  md: 8px
  lg: 16px
}
}`;
      const result = await themeSpecSymbolExtractorHandler.extract({
        source, file: 'design.theme',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const scales = symbols.filter((s: Record<string, string>) =>
        s.symbolString.includes('/scale/')
      );
      expect(scales).toHaveLength(3);
      expect(scales[0].symbolString).toBe('surface/theme/Design/scale/sm');
    });

    it('extracts semantic aliases', async () => {
      const source = `theme MyTheme {
semantic {
  text-primary: black
  text-secondary: gray
}
}`;
      const result = await themeSpecSymbolExtractorHandler.extract({
        source, file: 'semantic.theme',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const semantics = symbols.filter((s: Record<string, string>) =>
        s.symbolString.includes('/semantic/')
      );
      expect(semantics).toHaveLength(2);
      expect(semantics[0].symbolString).toBe('surface/theme/MyTheme/semantic/text-primary');
    });

    it('extracts mode variants', async () => {
      const source = `theme MyTheme {
modes {
  light: default
  dark: inverted
}
}`;
      const result = await themeSpecSymbolExtractorHandler.extract({
        source, file: 'modes.theme',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const modes = symbols.filter((s: Record<string, string>) =>
        s.symbolString.includes('/mode/')
      );
      expect(modes).toHaveLength(2);
      expect(modes[0].kind).toBe('variant');
      expect(modes[0].symbolString).toBe('surface/theme/MyTheme/mode/light');
    });

    it('extracts token references in {path} syntax', async () => {
      const source = `theme MyTheme {
semantic {
  text-primary: {tokens.primary}
  bg: {colors.white}
}
}`;
      const result = await themeSpecSymbolExtractorHandler.extract({
        source, file: 'refs.theme',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const refs = symbols.filter((s: Record<string, string>) => s.role === 'reference');
      expect(refs).toHaveLength(2);
      expect(refs[0].symbolString).toBe('surface/theme-ref/tokens.primary');
      expect(refs[1].symbolString).toBe('surface/theme-ref/colors.white');
    });

    it('skips structural keywords in token positions', async () => {
      const source = `theme MyTheme {
tokens {
  description: should be skipped
  type: should be skipped
  primary: #000
}
}`;
      const result = await themeSpecSymbolExtractorHandler.extract({
        source, file: 'test.theme',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const tokens = symbols.filter((s: Record<string, string>) =>
        s.symbolString.includes('/token/')
      );
      const tokenNames = tokens.map((t: Record<string, string>) => t.displayName);
      expect(tokenNames).not.toContain('description');
      expect(tokenNames).not.toContain('type');
      expect(tokenNames).toContain('primary');
    });

    it('returns empty symbols for empty source', async () => {
      const result = await themeSpecSymbolExtractorHandler.extract({
        source: '', file: 'empty.theme',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      expect(symbols).toHaveLength(0);
    });
  });

  // ── getSupportedExtensions ────────────────────────────────

  describe('getSupportedExtensions', () => {
    it('returns theme-related extensions', async () => {
      const result = await themeSpecSymbolExtractorHandler.getSupportedExtensions({}, storage);
      expect(result.variant).toBe('ok');
      const extensions = JSON.parse(result.extensions as string);
      expect(extensions).toContain('.theme');
      expect(extensions).toContain('.theme.yaml');
      expect(extensions).toContain('.theme.json');
    });
  });
});
