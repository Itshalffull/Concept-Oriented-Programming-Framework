// ============================================================
// ThemeImplementationEntity Handler Tests
//
// Tests for theme implementation registration, retrieval,
// file lookup, theme/platform queries, token resolution,
// and spec diffing.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { themeImplementationEntityHandler } from '../handlers/ts/score/theme-implementation-entity.handler.js';

describe('ThemeImplementationEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('register', () => {
    it('registers a new theme implementation', async () => {
      const result = await themeImplementationEntityHandler.register(
        { theme: 'aurora', platform: 'css', sourceFile: 'generated/aurora.css', ast: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.impl).toBeDefined();
    });

    it('returns alreadyRegistered for duplicate theme+platform', async () => {
      await themeImplementationEntityHandler.register(
        { theme: 'aurora', platform: 'css', sourceFile: 'generated/aurora.css', ast: '{}' },
        storage,
      );
      const result = await themeImplementationEntityHandler.register(
        { theme: 'aurora', platform: 'css', sourceFile: 'generated/aurora2.css', ast: '{}' },
        storage,
      );
      expect(result.variant).toBe('alreadyRegistered');
    });

    it('registers same theme for different platforms', async () => {
      const css = await themeImplementationEntityHandler.register(
        { theme: 'aurora', platform: 'css', sourceFile: 'generated/aurora.css', ast: '{}' },
        storage,
      );
      const rn = await themeImplementationEntityHandler.register(
        { theme: 'aurora', platform: 'react-native', sourceFile: 'generated/aurora.rn.ts', ast: '{}' },
        storage,
      );
      expect(css.impl).not.toBe(rn.impl);
    });

    it('stores token metadata from AST', async () => {
      const ast = JSON.stringify({
        tokenCount: 42,
        tokenPaths: [{ path: 'color.primary', resolvedValue: '#ff0000', specPath: 'palette.primary' }],
      });
      await themeImplementationEntityHandler.register(
        { theme: 'aurora', platform: 'css', sourceFile: 'generated/aurora.css', ast },
        storage,
      );
      const entry = (await storage.find('theme-implementations'))[0];
      expect(entry.tokenCount).toBe(42);
    });
  });

  describe('get', () => {
    it('retrieves by theme and platform', async () => {
      const reg = await themeImplementationEntityHandler.register(
        { theme: 'aurora', platform: 'css', sourceFile: 'generated/aurora.css', ast: '{}' },
        storage,
      );
      const result = await themeImplementationEntityHandler.get(
        { theme: 'aurora', platform: 'css' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.impl).toBe(reg.impl);
    });

    it('returns notfound for nonexistent', async () => {
      const result = await themeImplementationEntityHandler.get(
        { theme: 'nope', platform: 'css' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('getByFile', () => {
    it('finds by source file', async () => {
      const reg = await themeImplementationEntityHandler.register(
        { theme: 'aurora', platform: 'css', sourceFile: 'generated/aurora.css', ast: '{}' },
        storage,
      );
      const result = await themeImplementationEntityHandler.getByFile(
        { sourceFile: 'generated/aurora.css' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.impl).toBe(reg.impl);
    });

    it('returns notfound for unknown file', async () => {
      const result = await themeImplementationEntityHandler.getByFile(
        { sourceFile: 'unknown.css' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('findByTheme', () => {
    it('returns all implementations for a theme', async () => {
      await themeImplementationEntityHandler.register(
        { theme: 'aurora', platform: 'css', sourceFile: 'generated/aurora.css', ast: '{}' },
        storage,
      );
      await themeImplementationEntityHandler.register(
        { theme: 'aurora', platform: 'react-native', sourceFile: 'generated/aurora.rn.ts', ast: '{}' },
        storage,
      );
      const result = await themeImplementationEntityHandler.findByTheme(
        { theme: 'aurora' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const impls = JSON.parse(result.implementations as string);
      expect(impls).toHaveLength(2);
    });
  });

  describe('findByPlatform', () => {
    it('returns all implementations for a platform', async () => {
      await themeImplementationEntityHandler.register(
        { theme: 'aurora', platform: 'css', sourceFile: 'generated/aurora.css', ast: '{}' },
        storage,
      );
      await themeImplementationEntityHandler.register(
        { theme: 'midnight', platform: 'css', sourceFile: 'generated/midnight.css', ast: '{}' },
        storage,
      );
      const result = await themeImplementationEntityHandler.findByPlatform(
        { platform: 'css' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const impls = JSON.parse(result.implementations as string);
      expect(impls).toHaveLength(2);
    });
  });

  describe('resolveToken', () => {
    it('resolves a token path to its spec origin', async () => {
      const ast = JSON.stringify({
        tokenPaths: [{
          path: 'color.primary',
          resolvedValue: '#ff0000',
          specPath: 'palette.primary',
          platformSyntax: 'var(--color-primary)',
        }],
      });
      const reg = await themeImplementationEntityHandler.register(
        { theme: 'aurora', platform: 'css', sourceFile: 'generated/aurora.css', ast },
        storage,
      );
      const result = await themeImplementationEntityHandler.resolveToken(
        { impl: reg.impl, tokenPath: 'color.primary' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.resolvedValue).toBe('#ff0000');
      expect(result.specTokenPath).toBe('palette.primary');
      expect(result.platformSyntax).toBe('var(--color-primary)');
    });

    it('returns notfound for unknown token path', async () => {
      const reg = await themeImplementationEntityHandler.register(
        { theme: 'aurora', platform: 'css', sourceFile: 'generated/aurora.css', ast: '{}' },
        storage,
      );
      const result = await themeImplementationEntityHandler.resolveToken(
        { impl: reg.impl, tokenPath: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('returns notfound for nonexistent impl', async () => {
      const result = await themeImplementationEntityHandler.resolveToken(
        { impl: 'bad-id', tokenPath: 'color.primary' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('diffFromSpec', () => {
    it('returns inSync (stub)', async () => {
      const reg = await themeImplementationEntityHandler.register(
        { theme: 'aurora', platform: 'css', sourceFile: 'generated/aurora.css', ast: '{}' },
        storage,
      );
      const result = await themeImplementationEntityHandler.diffFromSpec(
        { impl: reg.impl },
        storage,
      );
      expect(result.variant).toBe('inSync');
    });
  });
});
