// ============================================================
// TypeScriptScopeProvider Handler Tests
//
// Tests for scope resolution in TypeScript files: module scopes,
// function scopes, class scopes, block scopes, var hoisting,
// let/const block scoping, and ES module import edges.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  typeScriptScopeProviderHandler,
  resetTypeScriptScopeProviderCounter,
} from '../handlers/ts/type-script-scope-provider.handler.js';

describe('TypeScriptScopeProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTypeScriptScopeProviderCounter();
  });

  // ── initialize ────────────────────────────────────────────

  describe('initialize', () => {
    it('initializes and returns ok with an instance id', async () => {
      const result = await typeScriptScopeProviderHandler.initialize({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('type-script-scope-provider-1');
    });
  });

  // ── buildScopes ───────────────────────────────────────────

  describe('buildScopes', () => {
    it('creates module-level scope for a file', async () => {
      const source = `const x = 1;`;
      const result = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'test.ts',
      }, storage);

      expect(result.variant).toBe('ok');
      const scopes = JSON.parse(result.scopes as string);
      expect(scopes[0].kind).toBe('module');
      expect(scopes[0].name).toBe('test.ts');
      expect(scopes[0].parentId).toBeNull();
    });

    it('creates function scope for function declarations', async () => {
      const source = `function greet(name: string) {
  const msg = 'Hello';
}`;
      const result = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'greet.ts',
      }, storage);

      const scopes = JSON.parse(result.scopes as string);
      const funcScope = scopes.find((s: Record<string, string>) => s.kind === 'function');
      expect(funcScope).toBeDefined();
      expect(funcScope.name).toBe('greet');
      expect(funcScope.parentId).toBe(scopes[0].id); // parent is module
    });

    it('creates class scope for class declarations', async () => {
      const source = `class UserService {
  getUser() {}
}`;
      const result = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'service.ts',
      }, storage);

      const scopes = JSON.parse(result.scopes as string);
      const classScope = scopes.find((s: Record<string, string>) => s.kind === 'class');
      expect(classScope).toBeDefined();
      expect(classScope.name).toBe('UserService');
    });

    it('creates block scope for if/for/while blocks', async () => {
      const source = `if (true) {
  const x = 1;
}`;
      const result = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'test.ts',
      }, storage);

      const scopes = JSON.parse(result.scopes as string);
      const blockScope = scopes.find((s: Record<string, string>) => s.kind === 'block');
      expect(blockScope).toBeDefined();
      expect(blockScope.name).toBe('if');
    });

    it('declares function with hoisted flag', async () => {
      const source = `function myFunc() {}`;
      const result = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'test.ts',
      }, storage);

      const declarations = JSON.parse(result.declarations as string);
      const funcDecl = declarations.find((d: Record<string, unknown>) => d.name === 'myFunc');
      expect(funcDecl).toBeDefined();
      expect(funcDecl.hoisted).toBe(true);
      expect(funcDecl.kind).toBe('function');
    });

    it('declares const/let as block-scoped (not hoisted)', async () => {
      const source = `const x = 1;
let y = 2;`;
      const result = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'test.ts',
      }, storage);

      const declarations = JSON.parse(result.declarations as string);
      const constDecl = declarations.find((d: Record<string, unknown>) => d.name === 'x');
      const letDecl = declarations.find((d: Record<string, unknown>) => d.name === 'y');
      expect(constDecl.hoisted).toBe(false);
      expect(letDecl.hoisted).toBe(false);
    });

    it('hoists var declarations to function scope', async () => {
      const source = `function outer() {
  if (true) {
    var x = 1;
  }
}`;
      const result = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'test.ts',
      }, storage);

      const scopes = JSON.parse(result.scopes as string);
      const declarations = JSON.parse(result.declarations as string);
      const varDecl = declarations.find((d: Record<string, unknown>) => d.name === 'x' && d.hoisted === true);
      expect(varDecl).toBeDefined();
      // var should be hoisted to the function scope, not block scope
      const funcScope = scopes.find((s: Record<string, string>) => s.kind === 'function');
      expect(varDecl.scopeId).toBe(funcScope.id);
    });

    it('extracts import edges for named imports', async () => {
      const source = `import { readFile, writeFile } from 'fs/promises';`;
      const result = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'io.ts',
      }, storage);

      const importEdges = JSON.parse(result.importEdges as string);
      expect(importEdges).toHaveLength(2);
      expect(importEdges[0].importedName).toBe('readFile');
      expect(importEdges[0].fromModule).toBe('fs/promises');
      expect(importEdges[1].importedName).toBe('writeFile');
    });

    it('extracts import edges for default imports', async () => {
      const source = `import express from 'express';`;
      const result = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'app.ts',
      }, storage);

      const importEdges = JSON.parse(result.importEdges as string);
      expect(importEdges).toHaveLength(1);
      expect(importEdges[0].importedName).toBe('default');
      expect(importEdges[0].localName).toBe('express');
    });

    it('handles aliased imports', async () => {
      const source = `import { readFile as read } from 'fs';`;
      const result = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'test.ts',
      }, storage);

      const importEdges = JSON.parse(result.importEdges as string);
      expect(importEdges[0].importedName).toBe('readFile');
      expect(importEdges[0].localName).toBe('read');
    });

    it('declares imported names in module scope', async () => {
      const source = `import { useState } from 'react';`;
      const result = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'component.tsx',
      }, storage);

      const declarations = JSON.parse(result.declarations as string);
      const importDecl = declarations.find((d: Record<string, string>) => d.name === 'useState');
      expect(importDecl).toBeDefined();
      expect(importDecl.symbolString).toBe('ts/import/react/useState');
    });

    it('declares interface and type in current scope', async () => {
      const source = `interface Config {
  port: number;
}
type Result = { ok: boolean };`;
      const result = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'types.ts',
      }, storage);

      const declarations = JSON.parse(result.declarations as string);
      expect(declarations.some((d: Record<string, string>) => d.name === 'Config' && d.kind === 'type')).toBe(true);
      expect(declarations.some((d: Record<string, string>) => d.name === 'Result' && d.kind === 'type')).toBe(true);
    });
  });

  // ── resolve ───────────────────────────────────────────────

  describe('resolve', () => {
    it('resolves a module-level declaration', async () => {
      const source = `const API_URL = 'http://localhost';
function handler() {}`;
      const buildResult = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'config.ts',
      }, storage);

      const scopes = JSON.parse(buildResult.scopes as string);
      const declarations = JSON.parse(buildResult.declarations as string);
      const importEdges = JSON.parse(buildResult.importEdges as string);
      const moduleScope = scopes.find((s: Record<string, string>) => s.kind === 'module');

      const result = await typeScriptScopeProviderHandler.resolve({
        name: 'API_URL',
        scopeId: moduleScope.id,
        scopes: JSON.stringify(scopes),
        declarations: JSON.stringify(declarations),
        importEdges: JSON.stringify(importEdges),
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbolString).toBe('ts/variable/config.ts/API_URL');
    });

    it('resolves from inner scope to outer scope', async () => {
      const source = `const baseUrl = 'http://api.com';
function fetchData() {
  const url = baseUrl + '/data';
}`;
      const buildResult = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'api.ts',
      }, storage);

      const scopes = JSON.parse(buildResult.scopes as string);
      const declarations = JSON.parse(buildResult.declarations as string);
      const importEdges = JSON.parse(buildResult.importEdges as string);
      const funcScope = scopes.find((s: Record<string, string>) => s.kind === 'function');

      const result = await typeScriptScopeProviderHandler.resolve({
        name: 'baseUrl',
        scopeId: funcScope.id,
        scopes: JSON.stringify(scopes),
        declarations: JSON.stringify(declarations),
        importEdges: JSON.stringify(importEdges),
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbolString).toBe('ts/variable/api.ts/baseUrl');
    });

    it('resolves imported names via import edges', async () => {
      const source = `import { useState } from 'react';
function Component() {
  const [x] = useState(0);
}`;
      const buildResult = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'comp.tsx',
      }, storage);

      const scopes = JSON.parse(buildResult.scopes as string);
      const declarations = JSON.parse(buildResult.declarations as string);
      const importEdges = JSON.parse(buildResult.importEdges as string);
      const funcScope = scopes.find((s: Record<string, string>) => s.kind === 'function');

      const result = await typeScriptScopeProviderHandler.resolve({
        name: 'useState',
        scopeId: funcScope.id,
        scopes: JSON.stringify(scopes),
        declarations: JSON.stringify(declarations),
        importEdges: JSON.stringify(importEdges),
      }, storage);

      expect(result.variant).toBe('ok');
      // Should resolve to import declaration
      expect(result.symbolString).toBe('ts/import/react/useState');
    });

    it('returns unresolved for unknown name', async () => {
      const source = `const x = 1;`;
      const buildResult = await typeScriptScopeProviderHandler.buildScopes({
        source, file: 'test.ts',
      }, storage);

      const scopes = JSON.parse(buildResult.scopes as string);
      const declarations = JSON.parse(buildResult.declarations as string);
      const importEdges = JSON.parse(buildResult.importEdges as string);

      const result = await typeScriptScopeProviderHandler.resolve({
        name: 'nonExistent',
        scopeId: scopes[0].id,
        scopes: JSON.stringify(scopes),
        declarations: JSON.stringify(declarations),
        importEdges: JSON.stringify(importEdges),
      }, storage);

      expect(result.variant).toBe('unresolved');
      expect(result.name).toBe('nonExistent');
    });
  });

  // ── getSupportedLanguages ─────────────────────────────────

  describe('getSupportedLanguages', () => {
    it('returns typescript and javascript', async () => {
      const result = await typeScriptScopeProviderHandler.getSupportedLanguages({}, storage);
      expect(result.variant).toBe('ok');
      const languages = JSON.parse(result.languages as string);
      expect(languages).toContain('typescript');
      expect(languages).toContain('javascript');
    });
  });
});
