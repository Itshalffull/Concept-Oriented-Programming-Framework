// ============================================================
// ProgramSlice Handler Tests
//
// Tests for computing backward and forward program slices
// from dependence graph edges, retrieving files and symbols
// in a slice, and handling edge cases (no data, criterion
// with location).
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  programSliceHandler,
  resetProgramSliceCounter,
} from '../implementations/typescript/program-slice.impl.js';

describe('ProgramSlice Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetProgramSliceCounter();
  });

  /**
   * Helper to insert dependence-graph edges into storage.
   * Edge semantics: "from" depends on "to" (from -> to).
   */
  async function addEdge(from: string, to: string, kind = 'data-dep') {
    const id = `edge-${from}-${to}`;
    await storage.put('dependence-graph-edge', id, { from, to, kind });
  }

  /**
   * Helper to create a minimal dependence-graph record so compute
   * does not return noDependenceData.
   */
  async function addGraphRecord() {
    await storage.put('dependence-graph', 'g1', {
      id: 'g1',
      scope: 'project',
      scopeRef: 'test',
      nodes: '[]',
      edges: '[]',
      nodeCount: 0,
      edgeCount: 0,
    });
  }

  // ----------------------------------------------------------
  // compute action
  // ----------------------------------------------------------

  describe('compute', () => {
    it('returns noDependenceData when no graph or edges exist', async () => {
      const result = await programSliceHandler.compute(
        { criterion: 'mySymbol', direction: 'backward' },
        storage,
      );

      expect(result.variant).toBe('noDependenceData');
      expect(result.message).toContain('mySymbol');
    });

    it('computes a backward slice (all things criterion depends on)', async () => {
      await addGraphRecord();
      // A depends on B, B depends on C
      await addEdge('A', 'B');
      await addEdge('B', 'C');

      const result = await programSliceHandler.compute(
        { criterion: 'A', direction: 'backward' },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.slice).toBe('program-slice-1');

      // Verify symbols in slice
      const symbolsResult = await programSliceHandler.symbolsInSlice(
        { slice: 'program-slice-1' },
        storage,
      );
      const symbols = JSON.parse(symbolsResult.symbols as string);
      expect(symbols).toContain('A');
      expect(symbols).toContain('B');
      expect(symbols).toContain('C');
    });

    it('computes a forward slice (all things that depend on criterion)', async () => {
      await addGraphRecord();
      // A depends on C, B depends on C
      await addEdge('A', 'C');
      await addEdge('B', 'C');

      const result = await programSliceHandler.compute(
        { criterion: 'C', direction: 'forward' },
        storage,
      );

      expect(result.variant).toBe('ok');

      const symbolsResult = await programSliceHandler.symbolsInSlice(
        { slice: result.slice as string },
        storage,
      );
      const symbols = JSON.parse(symbolsResult.symbols as string);
      expect(symbols).toContain('C');
      expect(symbols).toContain('A');
      expect(symbols).toContain('B');
    });

    it('defaults direction to backward for unknown values', async () => {
      await addGraphRecord();
      await addEdge('X', 'Y');

      const result = await programSliceHandler.compute(
        { criterion: 'X', direction: 'something-invalid' },
        storage,
      );

      expect(result.variant).toBe('ok');

      const info = await programSliceHandler.get(
        { slice: result.slice as string },
        storage,
      );
      expect(info.direction).toBe('backward');
    });

    it('parses criterion with @location syntax', async () => {
      await addGraphRecord();
      await addEdge('myFunc', 'dep');

      const result = await programSliceHandler.compute(
        { criterion: 'myFunc@src/handler.ts:10:5', direction: 'backward' },
        storage,
      );

      expect(result.variant).toBe('ok');

      const info = await programSliceHandler.get(
        { slice: result.slice as string },
        storage,
      );
      expect(info.criterionSymbol).toBe('myFunc');
    });

    it('extracts file information from symbol paths', async () => {
      await addGraphRecord();
      await addEdge('src/handler.ts', 'src/utils.ts');

      const result = await programSliceHandler.compute(
        { criterion: 'src/handler.ts', direction: 'backward' },
        storage,
      );

      expect(result.variant).toBe('ok');

      const filesResult = await programSliceHandler.filesInSlice(
        { slice: result.slice as string },
        storage,
      );
      const files = JSON.parse(filesResult.files as string);
      expect(files.length).toBeGreaterThan(0);
    });

    it('handles a transitive backward slice chain', async () => {
      await addGraphRecord();
      // A -> B -> C -> D (A depends on B, B depends on C, C depends on D)
      await addEdge('A', 'B');
      await addEdge('B', 'C');
      await addEdge('C', 'D');

      const result = await programSliceHandler.compute(
        { criterion: 'A', direction: 'backward' },
        storage,
      );

      expect(result.variant).toBe('ok');

      const symbolsResult = await programSliceHandler.symbolsInSlice(
        { slice: result.slice as string },
        storage,
      );
      const symbols = JSON.parse(symbolsResult.symbols as string);
      expect(symbols).toContain('A');
      expect(symbols).toContain('B');
      expect(symbols).toContain('C');
      expect(symbols).toContain('D');
    });

    it('handles a transitive forward slice chain', async () => {
      await addGraphRecord();
      // A -> D, B -> D, C -> B (A depends on D, B depends on D, C depends on B)
      await addEdge('A', 'D');
      await addEdge('B', 'D');
      await addEdge('C', 'B');

      // Forward from D: reverseAdj[D] = [A, B], reverseAdj[B] = [C]
      const result = await programSliceHandler.compute(
        { criterion: 'D', direction: 'forward' },
        storage,
      );

      expect(result.variant).toBe('ok');

      const symbolsResult = await programSliceHandler.symbolsInSlice(
        { slice: result.slice as string },
        storage,
      );
      const symbols = JSON.parse(symbolsResult.symbols as string);
      expect(symbols).toContain('D');
      expect(symbols).toContain('A');
      expect(symbols).toContain('B');
      expect(symbols).toContain('C');
    });
  });

  // ----------------------------------------------------------
  // filesInSlice action
  // ----------------------------------------------------------

  describe('filesInSlice', () => {
    it('returns empty array for a nonexistent slice', async () => {
      const result = await programSliceHandler.filesInSlice(
        { slice: 'nonexistent' },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.files).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // symbolsInSlice action
  // ----------------------------------------------------------

  describe('symbolsInSlice', () => {
    it('returns empty array for a nonexistent slice', async () => {
      const result = await programSliceHandler.symbolsInSlice(
        { slice: 'nonexistent' },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.symbols).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // get action
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns notfound for a nonexistent slice', async () => {
      const result = await programSliceHandler.get(
        { slice: 'nonexistent' },
        storage,
      );

      expect(result.variant).toBe('notfound');
    });

    it('returns full metadata for a computed slice', async () => {
      await addGraphRecord();
      await addEdge('A', 'B');
      await addEdge('B', 'C');

      const computeResult = await programSliceHandler.compute(
        { criterion: 'A', direction: 'backward' },
        storage,
      );

      const result = await programSliceHandler.get(
        { slice: computeResult.slice as string },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.slice).toBe('program-slice-1');
      expect(result.criterionSymbol).toBe('A');
      expect(result.direction).toBe('backward');
      expect(result.symbolCount).toBe(3); // A, B, C
      expect(result.edgeCount).toBe(2);
    });

    it('reports correct counts for forward slice', async () => {
      await addGraphRecord();
      // X depends on Z, Y depends on Z
      await addEdge('X', 'Z');
      await addEdge('Y', 'Z');

      const computeResult = await programSliceHandler.compute(
        { criterion: 'Z', direction: 'forward' },
        storage,
      );

      const result = await programSliceHandler.get(
        { slice: computeResult.slice as string },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.direction).toBe('forward');
      expect(result.symbolCount).toBe(3); // Z, X, Y
      expect(result.edgeCount).toBe(2);
    });
  });
});
