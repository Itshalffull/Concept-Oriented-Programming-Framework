// ============================================================
// TreeSitterThemeSpec Handler Tests
//
// Tree-sitter grammar provider for Clef Surface theme spec files.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  treeSitterThemeSpecHandler,
  resetTreeSitterThemeSpecCounter,
} from '../handlers/ts/tree-sitter-theme-spec.handler.js';

describe('TreeSitterThemeSpec', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTreeSitterThemeSpecCounter();
  });

  describe('initialize', () => {
    it('creates a grammar instance for theme-spec language', async () => {
      const result = await treeSitterThemeSpecHandler.initialize!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBeDefined();
    });

    it('returns existing instance on repeated initialization', async () => {
      const first = await treeSitterThemeSpecHandler.initialize!({}, storage);
      const second = await treeSitterThemeSpecHandler.initialize!({}, storage);
      expect(second.instance).toBe(first.instance);
    });
  });

  describe('parse', () => {
    it('parses a theme declaration with palette section', async () => {
      const source = `theme LightTheme {
  palette {
    primary: #3b82f6
    secondary: #10b981
    background: #ffffff
  }
}`;
      const result = await treeSitterThemeSpecHandler.parse!(
        { source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const tree = JSON.parse(result.tree as string);
      const themeDecl = tree.children.find((c: any) => c.type === 'theme_declaration');
      expect(themeDecl).toBeDefined();
      const themeName = themeDecl.children.find((c: any) => c.type === 'theme_name');
      expect(themeName.text).toBe('LightTheme');
      const paletteSection = themeDecl.children.find((c: any) => c.type === 'palette_section');
      expect(paletteSection).toBeDefined();
      expect(paletteSection.children.length).toBe(3);
    });

    it('parses extends clause for theme inheritance', async () => {
      const source = `theme DarkTheme extends LightTheme {
  palette {
    background: #1a1a2e
  }
}`;
      const result = await treeSitterThemeSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const themeDecl = tree.children.find((c: any) => c.type === 'theme_declaration');
      const extendsClause = themeDecl.children.find((c: any) => c.type === 'extends_clause');
      expect(extendsClause).toBeDefined();
      expect(extendsClause.text).toBe('LightTheme');
    });

    it('parses typography section', async () => {
      const source = `theme MyTheme {
  typography {
    font-family: "Inter"
    base-size: 16px
    line-height: 1.5rem
  }
}`;
      const result = await treeSitterThemeSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const themeDecl = tree.children.find((c: any) => c.type === 'theme_declaration');
      const typoSection = themeDecl.children.find((c: any) => c.type === 'typography_section');
      expect(typoSection).toBeDefined();
      expect(typoSection.children.length).toBe(3);
    });

    it('parses spacing and motion sections', async () => {
      const source = `theme MyTheme {
  spacing {
    xs: 4px
    sm: 8px
  }
  motion {
    duration-fast: 150ms
    duration-normal: 300ms
  }
}`;
      const result = await treeSitterThemeSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const themeDecl = tree.children.find((c: any) => c.type === 'theme_declaration');
      const spacingSection = themeDecl.children.find((c: any) => c.type === 'spacing_section');
      const motionSection = themeDecl.children.find((c: any) => c.type === 'motion_section');
      expect(spacingSection).toBeDefined();
      expect(motionSection).toBeDefined();
    });

    it('parses annotations', async () => {
      const source = `@version(2)
theme Themed {
  purpose {
  }
}`;
      const result = await treeSitterThemeSpecHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const annotations = tree.children.filter((c: any) => c.type === 'annotation');
      expect(annotations.length).toBe(1);
    });
  });

  describe('highlight', () => {
    it('identifies theme keywords', async () => {
      const source = `theme MyTheme extends Base {
  palette {
    primary: #ff0000
  }
}`;
      const result = await treeSitterThemeSpecHandler.highlight!(
        { source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const highlights = JSON.parse(result.highlights as string);
      const keywords = highlights.filter((h: any) => h.tokenType === 'keyword');
      expect(keywords.length).toBeGreaterThan(0);
    });

    it('identifies color value highlights', async () => {
      const source = `theme MyTheme {
  palette {
    primary: #3b82f6
  }
}`;
      const result = await treeSitterThemeSpecHandler.highlight!(
        { source },
        storage,
      );
      const highlights = JSON.parse(result.highlights as string);
      const colors = highlights.filter((h: any) => h.tokenType === 'color');
      expect(colors.length).toBeGreaterThan(0);
    });

    it('identifies numeric value highlights with units', async () => {
      const source = `theme MyTheme {
  spacing {
    base: 16px
    gap: 1.5rem
  }
}`;
      const result = await treeSitterThemeSpecHandler.highlight!(
        { source },
        storage,
      );
      const highlights = JSON.parse(result.highlights as string);
      const numbers = highlights.filter((h: any) => h.tokenType === 'number');
      expect(numbers.length).toBeGreaterThan(0);
    });
  });

  describe('query', () => {
    it('queries for token definitions', async () => {
      const source = `theme MyTheme {
  palette {
    primary: #ff0000
    secondary: #00ff00
  }
}`;
      const result = await treeSitterThemeSpecHandler.query!(
        { pattern: '(token_definition)', source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBe(2);
    });
  });

  describe('register', () => {
    it('returns theme-spec language registration info', async () => {
      const result = await treeSitterThemeSpecHandler.register!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.language).toBe('theme-spec');
      const extensions = JSON.parse(result.extensions as string);
      expect(extensions).toContain('.theme');
    });
  });
});
