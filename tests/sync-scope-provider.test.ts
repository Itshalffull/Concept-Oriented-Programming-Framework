// ============================================================
// SyncScopeProvider Handler Tests
//
// Tests for scope resolution in .sync files: sync-level scopes
// with when/where/then clause scoping, variable binding
// propagation, and concept/action references.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  syncScopeProviderHandler,
  resetSyncScopeProviderCounter,
} from '../handlers/ts/sync-scope-provider.handler.js';

describe('SyncScopeProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSyncScopeProviderCounter();
  });

  // ── initialize ────────────────────────────────────────────

  describe('initialize', () => {
    it('initializes and returns ok with an instance id', async () => {
      const result = await syncScopeProviderHandler.initialize({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('sync-scope-provider-1');
    });
  });

  // ── buildScopes ───────────────────────────────────────────

  describe('buildScopes', () => {
    it('builds global and sync scopes', async () => {
      const source = `sync ArticleLabel {
}`;
      const result = await syncScopeProviderHandler.buildScopes({
        source, file: 'article-label.sync',
      }, storage);

      expect(result.variant).toBe('ok');
      const scopes = JSON.parse(result.scopes as string);
      expect(scopes).toHaveLength(2); // global + sync
      expect(scopes[0].kind).toBe('global');
      expect(scopes[1].kind).toBe('module');
      expect(scopes[1].name).toBe('ArticleLabel');
    });

    it('declares sync name in global scope', async () => {
      const source = `sync ArticleLabel {
}`;
      const result = await syncScopeProviderHandler.buildScopes({
        source, file: 'article-label.sync',
      }, storage);

      const scopes = JSON.parse(result.scopes as string);
      const declarations = JSON.parse(result.declarations as string);
      const syncDecl = declarations.find((d: Record<string, string>) => d.name === 'ArticleLabel');
      expect(syncDecl).toBeDefined();
      expect(syncDecl.scopeId).toBe(scopes[0].id);
      expect(syncDecl.kind).toBe('sync');
      expect(syncDecl.symbolString).toBe('copf/sync/ArticleLabel');
    });

    it('creates when clause scope as child of sync scope', async () => {
      const source = `sync ArticleLabel {
  when Article.create(title: t)
}`;
      const result = await syncScopeProviderHandler.buildScopes({
        source, file: 'article-label.sync',
      }, storage);

      const scopes = JSON.parse(result.scopes as string);
      const whenScope = scopes.find((s: Record<string, string>) => s.name === 'when');
      expect(whenScope).toBeDefined();
      expect(whenScope.kind).toBe('block');
      const syncScope = scopes.find((s: Record<string, string>) => s.kind === 'module');
      expect(whenScope.parentId).toBe(syncScope.id);
    });

    it('creates where clause scope as child of sync scope', async () => {
      const source = `sync ArticleLabel {
  when Article.create(title: t)
  where t != ""
}`;
      const result = await syncScopeProviderHandler.buildScopes({
        source, file: 'article-label.sync',
      }, storage);

      const scopes = JSON.parse(result.scopes as string);
      const whereScope = scopes.find((s: Record<string, string>) => s.name === 'where');
      expect(whereScope).toBeDefined();
      const syncScope = scopes.find((s: Record<string, string>) => s.kind === 'module');
      expect(whereScope.parentId).toBe(syncScope.id);
    });

    it('creates then clause scope as child of sync scope', async () => {
      const source = `sync ArticleLabel {
  when Article.create(title: t)
  then Label.assign(name: t)
}`;
      const result = await syncScopeProviderHandler.buildScopes({
        source, file: 'article-label.sync',
      }, storage);

      const scopes = JSON.parse(result.scopes as string);
      const thenScope = scopes.find((s: Record<string, string>) => s.name === 'then');
      expect(thenScope).toBeDefined();
      const syncScope = scopes.find((s: Record<string, string>) => s.kind === 'module');
      expect(thenScope.parentId).toBe(syncScope.id);
    });

    it('binds variables to the sync scope for cross-clause visibility', async () => {
      const source = `sync ArticleLabel {
  when Article.create(title: myTitle)
  then Label.assign(name: myTitle)
}`;
      const result = await syncScopeProviderHandler.buildScopes({
        source, file: 'article-label.sync',
      }, storage);

      const scopes = JSON.parse(result.scopes as string);
      const declarations = JSON.parse(result.declarations as string);
      const syncScope = scopes.find((s: Record<string, string>) => s.kind === 'module');
      const varDecls = declarations.filter((d: Record<string, string>) =>
        d.kind === 'variable' && d.name === 'myTitle'
      );
      // Variables are bound to sync scope
      expect(varDecls.length).toBeGreaterThanOrEqual(1);
      expect(varDecls.some((d: Record<string, string>) => d.scopeId === syncScope.id)).toBe(true);
    });

    it('extracts concept and action references', async () => {
      const source = `sync ArticleLabel {
  when Article.create(title: t)
  then Label.assign(name: t)
}`;
      const result = await syncScopeProviderHandler.buildScopes({
        source, file: 'article-label.sync',
      }, storage);

      const references = JSON.parse(result.references as string);
      expect(references.some((r: Record<string, string>) => r.name === 'Article')).toBe(true);
      expect(references.some((r: Record<string, string>) => r.name === 'Article.create')).toBe(true);
      expect(references.some((r: Record<string, string>) => r.name === 'Label')).toBe(true);
      expect(references.some((r: Record<string, string>) => r.name === 'Label.assign')).toBe(true);
    });

    it('extracts variant references', async () => {
      const source = `sync ArticleLabel {
  when Article.create(title: t)
    -> ok(article: a)
}`;
      const result = await syncScopeProviderHandler.buildScopes({
        source, file: 'article-label.sync',
      }, storage);

      const references = JSON.parse(result.references as string);
      expect(references.some((r: Record<string, string>) => r.name === 'ok')).toBe(true);
    });

    it('skips keyword-like variable names', async () => {
      const source = `sync Test {
  when Article.create(val: string)
}`;
      const result = await syncScopeProviderHandler.buildScopes({
        source, file: 'test.sync',
      }, storage);

      const declarations = JSON.parse(result.declarations as string);
      const vars = declarations.filter((d: Record<string, string>) => d.kind === 'variable');
      const varNames = vars.map((v: Record<string, string>) => v.name);
      expect(varNames).not.toContain('string');
    });
  });

  // ── resolve ───────────────────────────────────────────────

  describe('resolve', () => {
    it('resolves variable bound in sync scope from then clause scope', async () => {
      const source = `sync ArticleLabel {
  when Article.create(title: myTitle)
  then Label.assign(name: myTitle)
}`;
      const buildResult = await syncScopeProviderHandler.buildScopes({
        source, file: 'article-label.sync',
      }, storage);

      const scopes = JSON.parse(buildResult.scopes as string);
      const declarations = JSON.parse(buildResult.declarations as string);
      const thenScope = scopes.find((s: Record<string, string>) => s.name === 'then');

      const result = await syncScopeProviderHandler.resolve({
        name: 'myTitle',
        scopeId: thenScope.id,
        scopes: JSON.stringify(scopes),
        declarations: JSON.stringify(declarations),
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbolString).toBe('copf/sync/ArticleLabel/var/myTitle');
    });

    it('resolves sync name from global scope', async () => {
      const source = `sync ArticleLabel {
}`;
      const buildResult = await syncScopeProviderHandler.buildScopes({
        source, file: 'article-label.sync',
      }, storage);

      const scopes = JSON.parse(buildResult.scopes as string);
      const declarations = JSON.parse(buildResult.declarations as string);
      const globalScope = scopes.find((s: Record<string, string>) => s.kind === 'global');

      const result = await syncScopeProviderHandler.resolve({
        name: 'ArticleLabel',
        scopeId: globalScope.id,
        scopes: JSON.stringify(scopes),
        declarations: JSON.stringify(declarations),
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbolString).toBe('copf/sync/ArticleLabel');
    });

    it('returns unresolved for unknown name', async () => {
      const source = `sync ArticleLabel {
}`;
      const buildResult = await syncScopeProviderHandler.buildScopes({
        source, file: 'article-label.sync',
      }, storage);

      const scopes = JSON.parse(buildResult.scopes as string);
      const declarations = JSON.parse(buildResult.declarations as string);

      const result = await syncScopeProviderHandler.resolve({
        name: 'unknownVar',
        scopeId: scopes[0].id,
        scopes: JSON.stringify(scopes),
        declarations: JSON.stringify(declarations),
      }, storage);

      expect(result.variant).toBe('unresolved');
      expect(result.name).toBe('unknownVar');
    });
  });

  // ── getSupportedLanguages ─────────────────────────────────

  describe('getSupportedLanguages', () => {
    it('returns sync-spec language', async () => {
      const result = await syncScopeProviderHandler.getSupportedLanguages({}, storage);
      expect(result.variant).toBe('ok');
      const languages = JSON.parse(result.languages as string);
      expect(languages).toContain('sync-spec');
    });
  });
});
