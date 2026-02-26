// ============================================================
// ConceptScopeProvider Handler Tests
//
// Tests for scope resolution in .concept files: concept-level
// scopes containing state fields, actions, variants, and type
// parameters. Verifies scope nesting and name resolution.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  conceptScopeProviderHandler,
  resetConceptScopeProviderCounter,
} from '../handlers/ts/concept-scope-provider.handler.js';

describe('ConceptScopeProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetConceptScopeProviderCounter();
  });

  // ── initialize ────────────────────────────────────────────

  describe('initialize', () => {
    it('initializes and returns ok with an instance id', async () => {
      const result = await conceptScopeProviderHandler.initialize({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('concept-scope-provider-1');
    });
  });

  // ── buildScopes ───────────────────────────────────────────

  describe('buildScopes', () => {
    it('builds global and concept scopes', async () => {
      const source = `concept Article {
  title: String
}`;
      const result = await conceptScopeProviderHandler.buildScopes({
        source, file: 'article.concept',
      }, storage);

      expect(result.variant).toBe('ok');
      const scopes = JSON.parse(result.scopes as string);
      expect(scopes).toHaveLength(2); // global + concept
      expect(scopes[0].kind).toBe('global');
      expect(scopes[1].kind).toBe('module');
      expect(scopes[1].name).toBe('Article');
      expect(scopes[1].parentId).toBe(scopes[0].id);
    });

    it('declares concept in global scope', async () => {
      const source = `concept Article {
}`;
      const result = await conceptScopeProviderHandler.buildScopes({
        source, file: 'article.concept',
      }, storage);

      const scopes = JSON.parse(result.scopes as string);
      const declarations = JSON.parse(result.declarations as string);
      const conceptDecl = declarations.find((d: Record<string, string>) => d.name === 'Article');
      expect(conceptDecl).toBeDefined();
      expect(conceptDecl.scopeId).toBe(scopes[0].id); // declared in global scope
      expect(conceptDecl.symbolString).toBe('copf/concept/Article');
      expect(conceptDecl.kind).toBe('concept');
    });

    it('declares type parameter in concept scope', async () => {
      const source = `concept Collection [T] {
}`;
      const result = await conceptScopeProviderHandler.buildScopes({
        source, file: 'collection.concept',
      }, storage);

      const scopes = JSON.parse(result.scopes as string);
      const declarations = JSON.parse(result.declarations as string);
      const typeParam = declarations.find((d: Record<string, string>) => d.name === 'T');
      expect(typeParam).toBeDefined();
      expect(typeParam.scopeId).toBe(scopes[1].id); // concept scope
      expect(typeParam.kind).toBe('type');
    });

    it('declares state fields in concept scope', async () => {
      const source = `concept Article {
  title: String
  body: Text
}`;
      const result = await conceptScopeProviderHandler.buildScopes({
        source, file: 'article.concept',
      }, storage);

      const declarations = JSON.parse(result.declarations as string);
      const fields = declarations.filter((d: Record<string, string>) => d.kind === 'state-field');
      expect(fields).toHaveLength(2);
      expect(fields[0].name).toBe('title');
      expect(fields[1].name).toBe('body');
    });

    it('creates action scope as child of concept scope', async () => {
      const source = `concept Article {
  action create(title: String)
}`;
      const result = await conceptScopeProviderHandler.buildScopes({
        source, file: 'article.concept',
      }, storage);

      const scopes = JSON.parse(result.scopes as string);
      expect(scopes).toHaveLength(3); // global + concept + action
      const actionScope = scopes.find((s: Record<string, string>) => s.kind === 'function');
      expect(actionScope).toBeDefined();
      expect(actionScope.name).toBe('create');
      // Action scope parent is concept scope
      const conceptScope = scopes.find((s: Record<string, string>) => s.kind === 'module');
      expect(actionScope.parentId).toBe(conceptScope.id);
    });

    it('declares action in concept scope', async () => {
      const source = `concept Article {
  action create(title: String)
}`;
      const result = await conceptScopeProviderHandler.buildScopes({
        source, file: 'article.concept',
      }, storage);

      const scopes = JSON.parse(result.scopes as string);
      const declarations = JSON.parse(result.declarations as string);
      const actionDecl = declarations.find((d: Record<string, string>) => d.kind === 'action');
      expect(actionDecl).toBeDefined();
      expect(actionDecl.name).toBe('create');
      const conceptScope = scopes.find((s: Record<string, string>) => s.kind === 'module');
      expect(actionDecl.scopeId).toBe(conceptScope.id);
    });

    it('declares action parameters in action scope', async () => {
      const source = `concept Article {
  action create(title: String, body: Text)
}`;
      const result = await conceptScopeProviderHandler.buildScopes({
        source, file: 'article.concept',
      }, storage);

      const scopes = JSON.parse(result.scopes as string);
      const declarations = JSON.parse(result.declarations as string);
      const actionScope = scopes.find((s: Record<string, string>) => s.kind === 'function');
      const params = declarations.filter((d: Record<string, string>) =>
        d.kind === 'variable' && d.scopeId === actionScope.id
      );
      expect(params).toHaveLength(2);
      expect(params[0].name).toBe('title');
      expect(params[1].name).toBe('body');
    });

    it('declares variants in action scope', async () => {
      const source = `concept Article {
  action create(title: String)
    -> ok(article: Article)
    -> invalidTitle(reason: String)
}`;
      const result = await conceptScopeProviderHandler.buildScopes({
        source, file: 'article.concept',
      }, storage);

      const scopes = JSON.parse(result.scopes as string);
      const declarations = JSON.parse(result.declarations as string);
      const actionScope = scopes.find((s: Record<string, string>) => s.kind === 'function');
      const variants = declarations.filter((d: Record<string, string>) =>
        d.kind === 'variant' && d.scopeId === actionScope.id
      );
      expect(variants).toHaveLength(2);
      expect(variants[0].name).toBe('ok');
      expect(variants[1].name).toBe('invalidTitle');
    });

    it('generates type references for state field types', async () => {
      const source = `concept Article {
  author: User
}`;
      const result = await conceptScopeProviderHandler.buildScopes({
        source, file: 'article.concept',
      }, storage);

      const references = JSON.parse(result.references as string);
      expect(references.some((r: Record<string, string>) => r.name === 'User')).toBe(true);
    });

    it('skips section keywords in state fields', async () => {
      const source = `concept Article {
  purpose: "test"
  actions: "test"
  title: String
}`;
      const result = await conceptScopeProviderHandler.buildScopes({
        source, file: 'article.concept',
      }, storage);

      const declarations = JSON.parse(result.declarations as string);
      const fields = declarations.filter((d: Record<string, string>) => d.kind === 'state-field');
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('title');
    });
  });

  // ── resolve ───────────────────────────────────────────────

  describe('resolve', () => {
    it('resolves a name in the same scope', async () => {
      const source = `concept Article {
  title: String
  action create(title: String)
}`;
      const buildResult = await conceptScopeProviderHandler.buildScopes({
        source, file: 'article.concept',
      }, storage);

      const scopes = JSON.parse(buildResult.scopes as string);
      const declarations = JSON.parse(buildResult.declarations as string);
      const conceptScope = scopes.find((s: Record<string, string>) => s.kind === 'module');

      const result = await conceptScopeProviderHandler.resolve({
        name: 'title',
        scopeId: conceptScope.id,
        scopes: JSON.stringify(scopes),
        declarations: JSON.stringify(declarations),
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbolString).toBe('copf/concept/Article/state/title');
    });

    it('resolves a name from parent scope', async () => {
      const source = `concept Article {
  title: String
  action create(body: String)
}`;
      const buildResult = await conceptScopeProviderHandler.buildScopes({
        source, file: 'article.concept',
      }, storage);

      const scopes = JSON.parse(buildResult.scopes as string);
      const declarations = JSON.parse(buildResult.declarations as string);
      const actionScope = scopes.find((s: Record<string, string>) => s.kind === 'function');

      // 'title' is in concept scope, resolving from action scope
      const result = await conceptScopeProviderHandler.resolve({
        name: 'title',
        scopeId: actionScope.id,
        scopes: JSON.stringify(scopes),
        declarations: JSON.stringify(declarations),
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbolString).toBe('copf/concept/Article/state/title');
    });

    it('resolves concept name from global scope', async () => {
      const source = `concept Article {
}`;
      const buildResult = await conceptScopeProviderHandler.buildScopes({
        source, file: 'article.concept',
      }, storage);

      const scopes = JSON.parse(buildResult.scopes as string);
      const declarations = JSON.parse(buildResult.declarations as string);
      const globalScope = scopes.find((s: Record<string, string>) => s.kind === 'global');

      const result = await conceptScopeProviderHandler.resolve({
        name: 'Article',
        scopeId: globalScope.id,
        scopes: JSON.stringify(scopes),
        declarations: JSON.stringify(declarations),
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbolString).toBe('copf/concept/Article');
    });

    it('returns unresolved for unknown name', async () => {
      const source = `concept Article {
}`;
      const buildResult = await conceptScopeProviderHandler.buildScopes({
        source, file: 'article.concept',
      }, storage);

      const scopes = JSON.parse(buildResult.scopes as string);
      const declarations = JSON.parse(buildResult.declarations as string);

      const result = await conceptScopeProviderHandler.resolve({
        name: 'nonExistent',
        scopeId: scopes[0].id,
        scopes: JSON.stringify(scopes),
        declarations: JSON.stringify(declarations),
      }, storage);

      expect(result.variant).toBe('unresolved');
      expect(result.name).toBe('nonExistent');
    });

    it('resolves type parameter from action scope', async () => {
      const source = `concept Collection [T] {
  action add(item: T)
}`;
      const buildResult = await conceptScopeProviderHandler.buildScopes({
        source, file: 'collection.concept',
      }, storage);

      const scopes = JSON.parse(buildResult.scopes as string);
      const declarations = JSON.parse(buildResult.declarations as string);
      const actionScope = scopes.find((s: Record<string, string>) => s.kind === 'function');

      const result = await conceptScopeProviderHandler.resolve({
        name: 'T',
        scopeId: actionScope.id,
        scopes: JSON.stringify(scopes),
        declarations: JSON.stringify(declarations),
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbolString).toBe('copf/concept/Collection/type/T');
    });
  });

  // ── getSupportedLanguages ─────────────────────────────────

  describe('getSupportedLanguages', () => {
    it('returns concept-spec language', async () => {
      const result = await conceptScopeProviderHandler.getSupportedLanguages({}, storage);
      expect(result.variant).toBe('ok');
      const languages = JSON.parse(result.languages as string);
      expect(languages).toContain('concept-spec');
    });
  });
});
