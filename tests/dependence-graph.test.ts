// ============================================================
// DependenceGraph Handler Tests
//
// Tests for computing dependence graphs, querying dependents
// and dependencies, forward/backward slicing, and impact
// analysis across file, module, and project scopes.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  dependenceGraphHandler,
  resetDependenceGraphCounter,
} from '../handlers/ts/dependence-graph.handler.js';

describe('DependenceGraph Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetDependenceGraphCounter();
  });

  /**
   * Helper: create a graph and add edges to it.
   * Edge semantics: "from" depends on "to" (i.e., from -> to).
   */
  async function createGraphWithEdges(
    scopeRef: string,
    edges: { from: string; to: string; kind: string }[],
  ): Promise<string> {
    const result = await dependenceGraphHandler.compute({ scopeRef }, storage);
    const graphId = result.graph as string;

    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      await storage.put('dependence-graph-edge', `edge-${graphId}-${i}`, {
        graphId,
        from: e.from,
        to: e.to,
        kind: e.kind,
      });
    }

    return graphId;
  }

  // ----------------------------------------------------------
  // compute action
  // ----------------------------------------------------------

  describe('compute', () => {
    it('creates a graph with file scope for file-like scopeRef', async () => {
      const result = await dependenceGraphHandler.compute(
        { scopeRef: 'src/handler.ts' },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.graph).toBe('dependence-graph-1');

      const info = await dependenceGraphHandler.get(
        { graph: result.graph as string },
        storage,
      );
      expect(info.scope).toBe('file');
    });

    it('creates a graph with module scope for module-like scopeRef', async () => {
      const result = await dependenceGraphHandler.compute(
        { scopeRef: 'mylib::handlers' },
        storage,
      );

      expect(result.variant).toBe('ok');

      const info = await dependenceGraphHandler.get(
        { graph: result.graph as string },
        storage,
      );
      expect(info.scope).toBe('module');
    });

    it('creates a graph with project scope for generic scopeRef', async () => {
      const result = await dependenceGraphHandler.compute(
        { scopeRef: 'my-project' },
        storage,
      );

      expect(result.variant).toBe('ok');

      const info = await dependenceGraphHandler.get(
        { graph: result.graph as string },
        storage,
      );
      expect(info.scope).toBe('project');
    });

    it('increments IDs across calls', async () => {
      const r1 = await dependenceGraphHandler.compute({ scopeRef: 'a.ts' }, storage);
      const r2 = await dependenceGraphHandler.compute({ scopeRef: 'b.ts' }, storage);

      expect(r1.graph).toBe('dependence-graph-1');
      expect(r2.graph).toBe('dependence-graph-2');
    });
  });

  // ----------------------------------------------------------
  // get action
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns notfound for a nonexistent graph', async () => {
      const result = await dependenceGraphHandler.get(
        { graph: 'nonexistent' },
        storage,
      );

      expect(result.variant).toBe('notfound');
    });

    it('counts nodes and edges correctly', async () => {
      const graphId = await createGraphWithEdges('src/app.ts', [
        { from: 'A', to: 'B', kind: 'data-dep' },
        { from: 'B', to: 'C', kind: 'call' },
        { from: 'A', to: 'C', kind: 'import' },
      ]);

      const result = await dependenceGraphHandler.get({ graph: graphId }, storage);

      expect(result.variant).toBe('ok');
      expect(result.nodeCount).toBe(3); // A, B, C
      expect(result.edgeCount).toBe(3);
    });
  });

  // ----------------------------------------------------------
  // queryDependents action
  // ----------------------------------------------------------

  describe('queryDependents', () => {
    it('finds all nodes that depend on a given symbol', async () => {
      // Edge from -> to means "from depends on to"
      // queryDependents('C') should find A and B (both depend on C)
      await createGraphWithEdges('project', [
        { from: 'A', to: 'C', kind: 'data-dep' },
        { from: 'B', to: 'C', kind: 'call' },
        { from: 'D', to: 'E', kind: 'import' },
      ]);

      const result = await dependenceGraphHandler.queryDependents(
        { symbol: 'C', edgeKinds: '' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const dependents = JSON.parse(result.dependents as string);
      const symbols = dependents.map((d: { symbol: string }) => d.symbol);
      expect(symbols).toContain('A');
      expect(symbols).toContain('B');
      expect(symbols).not.toContain('D');
    });

    it('filters by edge kind', async () => {
      await createGraphWithEdges('project', [
        { from: 'A', to: 'C', kind: 'data-dep' },
        { from: 'B', to: 'C', kind: 'call' },
      ]);

      const result = await dependenceGraphHandler.queryDependents(
        { symbol: 'C', edgeKinds: 'call' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const dependents = JSON.parse(result.dependents as string);
      expect(dependents.length).toBe(1);
      expect(dependents[0].symbol).toBe('B');
      expect(dependents[0].edgeKind).toBe('call');
    });

    it('returns empty for a symbol with no dependents', async () => {
      await createGraphWithEdges('project', [
        { from: 'A', to: 'B', kind: 'data-dep' },
      ]);

      const result = await dependenceGraphHandler.queryDependents(
        { symbol: 'A', edgeKinds: '' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const dependents = JSON.parse(result.dependents as string);
      expect(dependents.length).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // queryDependencies action
  // ----------------------------------------------------------

  describe('queryDependencies', () => {
    it('finds all symbols that a given symbol depends on', async () => {
      // Edge from -> to means "from depends on to"
      // queryDependencies('A') should find B and C
      await createGraphWithEdges('project', [
        { from: 'A', to: 'B', kind: 'data-dep' },
        { from: 'A', to: 'C', kind: 'import' },
        { from: 'D', to: 'E', kind: 'call' },
      ]);

      const result = await dependenceGraphHandler.queryDependencies(
        { symbol: 'A', edgeKinds: '' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const deps = JSON.parse(result.dependencies as string);
      const symbols = deps.map((d: { symbol: string }) => d.symbol);
      expect(symbols).toContain('B');
      expect(symbols).toContain('C');
      expect(symbols).not.toContain('E');
    });

    it('filters by edge kind', async () => {
      await createGraphWithEdges('project', [
        { from: 'A', to: 'B', kind: 'data-dep' },
        { from: 'A', to: 'C', kind: 'import' },
      ]);

      const result = await dependenceGraphHandler.queryDependencies(
        { symbol: 'A', edgeKinds: 'import' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const deps = JSON.parse(result.dependencies as string);
      expect(deps.length).toBe(1);
      expect(deps[0].symbol).toBe('C');
    });

    it('returns empty for a symbol with no dependencies', async () => {
      await createGraphWithEdges('project', [
        { from: 'A', to: 'B', kind: 'data-dep' },
      ]);

      const result = await dependenceGraphHandler.queryDependencies(
        { symbol: 'B', edgeKinds: '' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const deps = JSON.parse(result.dependencies as string);
      expect(deps.length).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // sliceForward action
  // ----------------------------------------------------------

  describe('sliceForward', () => {
    it('computes forward slice: all nodes affected by changes to criterion', async () => {
      // Forward slice uses reverseAdj (transitiveBackward from criterion).
      // Edge from -> to means "from depends on to".
      // sliceForward('C') = all nodes transitively depending on C.
      // reverseAdj[C] = [A], reverseAdj[A] = [] => forward slice = {C, A}
      await createGraphWithEdges('project', [
        { from: 'A', to: 'C', kind: 'data-dep' },
        { from: 'B', to: 'D', kind: 'data-dep' },
      ]);

      const result = await dependenceGraphHandler.sliceForward(
        { criterion: 'C' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const slice = JSON.parse(result.slice as string);
      expect(slice).toContain('C');
      expect(slice).toContain('A');
      expect(slice).not.toContain('B');
    });

    it('computes transitive forward slice', async () => {
      // A -> B -> C (A depends on B, B depends on C)
      // sliceForward('C') = all depending on C transitively = {C, B, A}
      await createGraphWithEdges('project', [
        { from: 'A', to: 'B', kind: 'data-dep' },
        { from: 'B', to: 'C', kind: 'data-dep' },
      ]);

      const result = await dependenceGraphHandler.sliceForward(
        { criterion: 'C' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const slice = JSON.parse(result.slice as string);
      expect(slice).toContain('C');
      expect(slice).toContain('B');
      expect(slice).toContain('A');
    });
  });

  // ----------------------------------------------------------
  // sliceBackward action
  // ----------------------------------------------------------

  describe('sliceBackward', () => {
    it('computes backward slice: all symbols that contribute to criterion', async () => {
      // Backward slice uses adj (transitiveForward from criterion).
      // Edge from -> to means "from depends on to".
      // sliceBackward('A') = everything A transitively depends on.
      // adj[A] = [B], adj[B] = [C] => backward slice = {A, B, C}
      await createGraphWithEdges('project', [
        { from: 'A', to: 'B', kind: 'data-dep' },
        { from: 'B', to: 'C', kind: 'data-dep' },
      ]);

      const result = await dependenceGraphHandler.sliceBackward(
        { criterion: 'A' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const slice = JSON.parse(result.slice as string);
      expect(slice).toContain('A');
      expect(slice).toContain('B');
      expect(slice).toContain('C');
    });

    it('returns only the criterion when it has no dependencies', async () => {
      await createGraphWithEdges('project', [
        { from: 'A', to: 'B', kind: 'data-dep' },
      ]);

      const result = await dependenceGraphHandler.sliceBackward(
        { criterion: 'B' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const slice = JSON.parse(result.slice as string);
      expect(slice).toEqual(['B']);
    });
  });

  // ----------------------------------------------------------
  // impactAnalysis action
  // ----------------------------------------------------------

  describe('impactAnalysis', () => {
    it('computes impact of changing a single symbol', async () => {
      // A -> C, B -> C, D -> A (A depends on C, B depends on C, D depends on A)
      // Impact of changing C: everything depending on C transitively.
      // reverseAdj[C] = [A, B], reverseAdj[A] = [D]
      // affected = {A, B, D} (excluding C itself)
      await createGraphWithEdges('project', [
        { from: 'A', to: 'C', kind: 'data-dep' },
        { from: 'B', to: 'C', kind: 'call' },
        { from: 'D', to: 'A', kind: 'data-dep' },
      ]);

      const result = await dependenceGraphHandler.impactAnalysis(
        { changed: JSON.stringify(['C']) },
        storage,
      );

      expect(result.variant).toBe('ok');
      const affected = JSON.parse(result.affected as string);
      expect(affected).toContain('A');
      expect(affected).toContain('B');
      expect(affected).toContain('D');
      expect(affected).not.toContain('C');
    });

    it('computes impact of changing multiple symbols', async () => {
      await createGraphWithEdges('project', [
        { from: 'X', to: 'A', kind: 'data-dep' },
        { from: 'Y', to: 'B', kind: 'data-dep' },
        { from: 'Z', to: 'C', kind: 'data-dep' },
      ]);

      const result = await dependenceGraphHandler.impactAnalysis(
        { changed: JSON.stringify(['A', 'B']) },
        storage,
      );

      expect(result.variant).toBe('ok');
      const affected = JSON.parse(result.affected as string);
      expect(affected).toContain('X');
      expect(affected).toContain('Y');
      expect(affected).not.toContain('Z');
    });

    it('parses comma-separated changed symbols', async () => {
      await createGraphWithEdges('project', [
        { from: 'X', to: 'A', kind: 'data-dep' },
        { from: 'Y', to: 'B', kind: 'data-dep' },
      ]);

      const result = await dependenceGraphHandler.impactAnalysis(
        { changed: 'A, B' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const affected = JSON.parse(result.affected as string);
      expect(affected).toContain('X');
      expect(affected).toContain('Y');
    });

    it('returns empty affected set when nothing depends on the changed symbol', async () => {
      await createGraphWithEdges('project', [
        { from: 'A', to: 'B', kind: 'data-dep' },
      ]);

      const result = await dependenceGraphHandler.impactAnalysis(
        { changed: JSON.stringify(['A']) },
        storage,
      );

      expect(result.variant).toBe('ok');
      const affected = JSON.parse(result.affected as string);
      expect(affected.length).toBe(0);
    });

    it('includes traversed paths in the result', async () => {
      await createGraphWithEdges('project', [
        { from: 'A', to: 'C', kind: 'data-dep' },
      ]);

      const result = await dependenceGraphHandler.impactAnalysis(
        { changed: JSON.stringify(['C']) },
        storage,
      );

      expect(result.variant).toBe('ok');
      const paths = JSON.parse(result.paths as string);
      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0]).toHaveProperty('from');
      expect(paths[0]).toHaveProperty('to');
      expect(paths[0]).toHaveProperty('kind');
    });
  });
});
