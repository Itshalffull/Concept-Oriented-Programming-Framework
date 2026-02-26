// ============================================================
// SyncSpecSymbolExtractor Handler Tests
//
// Tests for extracting symbols from .sync files: sync names,
// concept references, action references, variable bindings,
// and variant references.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  syncSpecSymbolExtractorHandler,
  resetSyncSpecSymbolExtractorCounter,
} from '../handlers/ts/sync-spec-symbol-extractor.handler.js';

describe('SyncSpecSymbolExtractor', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSyncSpecSymbolExtractorCounter();
  });

  // ── initialize ────────────────────────────────────────────

  describe('initialize', () => {
    it('initializes and returns ok with an instance id', async () => {
      const result = await syncSpecSymbolExtractorHandler.initialize({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('sync-spec-symbol-extractor-1');
    });
  });

  // ── extract ───────────────────────────────────────────────

  describe('extract', () => {
    it('extracts sync declaration', async () => {
      const source = `sync ArticleLabel {
}`;
      const result = await syncSpecSymbolExtractorHandler.extract({
        source, file: 'article-label.sync',
      }, storage);

      expect(result.variant).toBe('ok');
      const symbols = JSON.parse(result.symbols as string);
      const syncDef = symbols.find((s: Record<string, string>) => s.kind === 'sync');
      expect(syncDef).toBeDefined();
      expect(syncDef.symbolString).toBe('clef/sync/ArticleLabel');
      expect(syncDef.displayName).toBe('ArticleLabel');
      expect(syncDef.role).toBe('definition');
    });

    it('extracts concept references from when/then clauses', async () => {
      const source = `sync ArticleLabel {
  when Article.create(title: t)
  then Label.assign(name: t)
}`;
      const result = await syncSpecSymbolExtractorHandler.extract({
        source, file: 'article-label.sync',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const conceptRefs = symbols.filter((s: Record<string, string>) =>
        s.kind === 'concept' && s.role === 'reference'
      );
      expect(conceptRefs).toHaveLength(2);
      expect(conceptRefs.map((r: Record<string, string>) => r.displayName)).toContain('Article');
      expect(conceptRefs.map((r: Record<string, string>) => r.displayName)).toContain('Label');
    });

    it('extracts action references from concept.action patterns', async () => {
      const source = `sync ArticleLabel {
  when Article.create(title: t)
  then Label.assign(name: t)
}`;
      const result = await syncSpecSymbolExtractorHandler.extract({
        source, file: 'article-label.sync',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const actionRefs = symbols.filter((s: Record<string, string>) =>
        s.kind === 'action' && s.role === 'reference'
      );
      expect(actionRefs).toHaveLength(2);
      expect(actionRefs[0].symbolString).toBe('clef/concept/Article/action/create');
      expect(actionRefs[1].symbolString).toBe('clef/concept/Label/action/assign');
    });

    it('extracts variable bindings', async () => {
      const source = `sync ArticleLabel {
  when Article.create(title: myTitle)
}`;
      const result = await syncSpecSymbolExtractorHandler.extract({
        source, file: 'article-label.sync',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const vars = symbols.filter((s: Record<string, string>) => s.kind === 'variable');
      expect(vars.some((v: Record<string, string>) => v.displayName === 'myTitle')).toBe(true);
    });

    it('skips keyword-like variable names', async () => {
      const source = `sync Test {
  when Article.create(value: string)
}`;
      const result = await syncSpecSymbolExtractorHandler.extract({
        source, file: 'test.sync',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const vars = symbols.filter((s: Record<string, string>) => s.kind === 'variable');
      const varNames = vars.map((v: Record<string, string>) => v.displayName);
      expect(varNames).not.toContain('string');
    });

    it('extracts variant references', async () => {
      const source = `sync ArticleLabel {
  when Article.create(title: t)
    -> ok(article: a)
  then Label.assign(name: t)
}`;
      const result = await syncSpecSymbolExtractorHandler.extract({
        source, file: 'article-label.sync',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const variants = symbols.filter((s: Record<string, string>) =>
        s.kind === 'variant' && s.role === 'reference'
      );
      expect(variants).toHaveLength(1);
      expect(variants[0].displayName).toBe('ok');
    });

    it('returns empty symbols for empty source', async () => {
      const result = await syncSpecSymbolExtractorHandler.extract({
        source: '', file: 'empty.sync',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      expect(symbols).toHaveLength(0);
    });
  });

  // ── getSupportedExtensions ────────────────────────────────

  describe('getSupportedExtensions', () => {
    it('returns .sync extension', async () => {
      const result = await syncSpecSymbolExtractorHandler.getSupportedExtensions({}, storage);
      expect(result.variant).toBe('ok');
      const extensions = JSON.parse(result.extensions as string);
      expect(extensions).toContain('.sync');
    });
  });
});
