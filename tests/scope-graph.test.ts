// ============================================================
// ScopeGraph Handler Tests
//
// Tests for lexical scoping, visibility, and name resolution.
// Covers build, resolveReference, visibleSymbols,
// resolveCrossFile, and get actions.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  scopeGraphHandler,
  resetScopeGraphCounter,
} from '../implementations/typescript/scope-graph.impl.js';

describe('ScopeGraph', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetScopeGraphCounter();
  });

  // ── build ─────────────────────────────────────────────────

  describe('build', () => {
    it('builds a scope graph from a valid tree', async () => {
      const tree = JSON.stringify({
        language: 'typescript',
        nodes: [
          { type: 'declaration', name: 'foo', symbolString: 'ts/var/foo', declKind: 'variable' },
          { type: 'scope', name: 'myFunc', scopeKind: 'function' },
          { type: 'reference', name: 'bar' },
        ],
      });

      const result = await scopeGraphHandler.build({ file: 'test.ts', tree }, storage);
      expect(result.variant).toBe('ok');
      expect(result.graph).toBe('scope-graph-1');
    });

    it('creates minimal scope for invalid JSON tree', async () => {
      const result = await scopeGraphHandler.build({
        file: 'test.ts', tree: 'NOT VALID JSON',
      }, storage);

      expect(result.variant).toBe('ok');
      const getResult = await scopeGraphHandler.get({ graph: result.graph }, storage);
      expect(getResult.scopeCount).toBe(1); // Just the global scope
      expect(getResult.declarationCount).toBe(0);
    });

    it('counts unresolved references', async () => {
      const tree = JSON.stringify({
        language: 'typescript',
        nodes: [
          { type: 'reference', name: 'unknownA' },
          { type: 'reference', name: 'unknownB' },
          { type: 'reference', name: 'known', resolved: 'ts/var/known' },
        ],
      });

      const result = await scopeGraphHandler.build({ file: 'test.ts', tree }, storage);
      const getResult = await scopeGraphHandler.get({ graph: result.graph }, storage);
      expect(getResult.unresolvedCount).toBe(2);
    });

    it('processes import nodes', async () => {
      const tree = JSON.stringify({
        language: 'typescript',
        nodes: [
          { type: 'import', name: 'React', fromModule: 'react', resolvedSymbol: 'ts/import/react/React' },
        ],
      });

      const result = await scopeGraphHandler.build({ file: 'test.tsx', tree }, storage);
      expect(result.variant).toBe('ok');
    });
  });

  // ── resolveReference ──────────────────────────────────────

  describe('resolveReference', () => {
    it('resolves a name from a declaration in the same scope', async () => {
      const tree = JSON.stringify({
        language: 'typescript',
        nodes: [
          { type: 'declaration', name: 'myVar', symbolString: 'ts/var/myVar', declKind: 'variable' },
        ],
      });

      const buildResult = await scopeGraphHandler.build({ file: 'test.ts', tree }, storage);
      const graphId = buildResult.graph as string;

      // The module scope is scope-2 (scope-1 is from global scope generation within the graph)
      // We need to get the actual scope id from the stored graph
      const record = await storage.get('scope-graph', graphId);
      const scopes = JSON.parse(record!.scopes as string);
      const moduleScope = scopes.find((s: Record<string, string>) => s.kind === 'module');

      const result = await scopeGraphHandler.resolveReference({
        graph: graphId, scope: moduleScope.id, name: 'myVar',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbol).toBe('ts/var/myVar');
    });

    it('resolves through parent scope chain', async () => {
      const tree = JSON.stringify({
        language: 'typescript',
        nodes: [
          { type: 'declaration', name: 'globalVar', symbolString: 'ts/var/globalVar', declKind: 'variable' },
          { type: 'scope', name: 'innerFunc', scopeKind: 'function' },
        ],
      });

      const buildResult = await scopeGraphHandler.build({ file: 'test.ts', tree }, storage);
      const graphId = buildResult.graph as string;

      const record = await storage.get('scope-graph', graphId);
      const scopes = JSON.parse(record!.scopes as string);
      const innerScope = scopes.find((s: Record<string, string>) => s.kind === 'function');

      const result = await scopeGraphHandler.resolveReference({
        graph: graphId, scope: innerScope.id, name: 'globalVar',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbol).toBe('ts/var/globalVar');
    });

    it('resolves import edges', async () => {
      const tree = JSON.stringify({
        language: 'typescript',
        nodes: [
          { type: 'import', name: 'useState', fromModule: 'react', resolvedSymbol: 'react/hook/useState' },
        ],
      });

      const buildResult = await scopeGraphHandler.build({ file: 'test.tsx', tree }, storage);
      const graphId = buildResult.graph as string;

      const record = await storage.get('scope-graph', graphId);
      const scopes = JSON.parse(record!.scopes as string);
      const moduleScope = scopes.find((s: Record<string, string>) => s.kind === 'module');

      const result = await scopeGraphHandler.resolveReference({
        graph: graphId, scope: moduleScope.id, name: 'useState',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.symbol).toBe('react/hook/useState');
    });

    it('returns unresolved for unknown name', async () => {
      const tree = JSON.stringify({ language: 'typescript', nodes: [] });
      const buildResult = await scopeGraphHandler.build({ file: 'test.ts', tree }, storage);

      const record = await storage.get('scope-graph', buildResult.graph as string);
      const scopes = JSON.parse(record!.scopes as string);

      const result = await scopeGraphHandler.resolveReference({
        graph: buildResult.graph, scope: scopes[0].id, name: 'nonExistent',
      }, storage);

      expect(result.variant).toBe('unresolved');
    });

    it('returns unresolved for missing graph', async () => {
      const result = await scopeGraphHandler.resolveReference({
        graph: 'nonexistent', scope: 'scope-1', name: 'x',
      }, storage);

      expect(result.variant).toBe('unresolved');
    });
  });

  // ── visibleSymbols ────────────────────────────────────────

  describe('visibleSymbols', () => {
    it('collects declarations from current and parent scopes', async () => {
      const tree = JSON.stringify({
        language: 'typescript',
        nodes: [
          { type: 'declaration', name: 'topLevel', symbolString: 'ts/var/topLevel', declKind: 'variable' },
          { type: 'scope', name: 'innerBlock', scopeKind: 'block' },
        ],
      });

      const buildResult = await scopeGraphHandler.build({ file: 'test.ts', tree }, storage);
      const graphId = buildResult.graph as string;

      const record = await storage.get('scope-graph', graphId);
      const scopes = JSON.parse(record!.scopes as string);
      const blockScope = scopes.find((s: Record<string, string>) => s.kind === 'block');

      const result = await scopeGraphHandler.visibleSymbols({
        graph: graphId, scope: blockScope.id,
      }, storage);

      expect(result.variant).toBe('ok');
      const symbols = JSON.parse(result.symbols as string);
      expect(symbols.some((s: Record<string, string>) => s.name === 'topLevel')).toBe(true);
    });

    it('includes imports as visible symbols', async () => {
      const tree = JSON.stringify({
        language: 'typescript',
        nodes: [
          { type: 'import', name: 'React', fromModule: 'react', resolvedSymbol: 'ts/import/react/React' },
        ],
      });

      const buildResult = await scopeGraphHandler.build({ file: 'test.tsx', tree }, storage);
      const record = await storage.get('scope-graph', buildResult.graph as string);
      const scopes = JSON.parse(record!.scopes as string);

      const result = await scopeGraphHandler.visibleSymbols({
        graph: buildResult.graph, scope: scopes[0].id,
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      expect(symbols.some((s: Record<string, string>) => s.name === 'React')).toBe(true);
    });

    it('returns empty array for missing graph', async () => {
      const result = await scopeGraphHandler.visibleSymbols({
        graph: 'nonexistent', scope: 'scope-1',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(JSON.parse(result.symbols as string)).toHaveLength(0);
    });
  });

  // ── resolveCrossFile ──────────────────────────────────────

  describe('resolveCrossFile', () => {
    it('resolves unresolved references using declarations from other graphs', async () => {
      // First graph has a declaration
      const tree1 = JSON.stringify({
        language: 'typescript',
        nodes: [
          { type: 'declaration', name: 'sharedUtil', symbolString: 'ts/function/util.ts/sharedUtil', declKind: 'function' },
        ],
      });
      await scopeGraphHandler.build({ file: 'util.ts', tree: tree1 }, storage);

      // Second graph has an unresolved reference to sharedUtil
      const tree2 = JSON.stringify({
        language: 'typescript',
        nodes: [
          { type: 'reference', name: 'sharedUtil' },
        ],
      });
      const build2 = await scopeGraphHandler.build({ file: 'main.ts', tree: tree2 }, storage);

      const result = await scopeGraphHandler.resolveCrossFile({
        graph: build2.graph,
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.resolvedCount).toBe(1);

      // Verify the unresolved count was updated
      const getResult = await scopeGraphHandler.get({ graph: build2.graph }, storage);
      expect(getResult.unresolvedCount).toBe(0);
    });

    it('returns noUnresolved when all references are already resolved', async () => {
      const tree = JSON.stringify({
        language: 'typescript',
        nodes: [
          { type: 'reference', name: 'x', resolved: 'ts/var/x' },
        ],
      });
      const buildResult = await scopeGraphHandler.build({ file: 'test.ts', tree }, storage);

      const result = await scopeGraphHandler.resolveCrossFile({
        graph: buildResult.graph,
      }, storage);

      expect(result.variant).toBe('noUnresolved');
    });

    it('returns noUnresolved for missing graph', async () => {
      const result = await scopeGraphHandler.resolveCrossFile({
        graph: 'nonexistent',
      }, storage);

      expect(result.variant).toBe('noUnresolved');
    });
  });

  // ── get ───────────────────────────────────────────────────

  describe('get', () => {
    it('returns graph metadata', async () => {
      const tree = JSON.stringify({
        language: 'typescript',
        nodes: [
          { type: 'declaration', name: 'a', symbolString: 'ts/var/a', declKind: 'variable' },
          { type: 'declaration', name: 'b', symbolString: 'ts/var/b', declKind: 'variable' },
          { type: 'scope', name: 'block', scopeKind: 'block' },
        ],
      });

      const buildResult = await scopeGraphHandler.build({ file: 'test.ts', tree }, storage);
      const result = await scopeGraphHandler.get({ graph: buildResult.graph }, storage);

      expect(result.variant).toBe('ok');
      expect(result.file).toBe('test.ts');
      expect(result.scopeCount).toBe(2); // module + block
      expect(result.declarationCount).toBe(2);
      expect(result.unresolvedCount).toBe(0);
    });

    it('returns notfound for missing graph', async () => {
      const result = await scopeGraphHandler.get({ graph: 'nonexistent' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });
});
