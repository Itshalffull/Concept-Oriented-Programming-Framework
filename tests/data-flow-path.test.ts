// ============================================================
// DataFlowPath Handler Tests
//
// Tests for tracing data flow paths from source to sink through
// dependence graph edges. Covers taint tracking, config
// propagation, and output derivation path inference.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  dataFlowPathHandler,
  resetDataFlowPathCounter,
} from '../handlers/ts/data-flow-path.handler.js';

describe('DataFlowPath Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetDataFlowPathCounter();
  });

  /**
   * Helper to insert dependence-graph edges into storage.
   */
  async function addEdge(from: string, to: string, id?: string) {
    const edgeId = id ?? `edge-${from}-${to}`;
    await storage.put('dependence-graph-edge', edgeId, { from, to });
  }

  // ----------------------------------------------------------
  // trace action
  // ----------------------------------------------------------

  describe('trace', () => {
    it('returns noPath when no edges exist', async () => {
      const result = await dataFlowPathHandler.trace(
        { source: 'A', sink: 'Z' },
        storage,
      );

      expect(result.variant).toBe('noPath');
    });

    it('returns noPath when source and sink are not connected', async () => {
      await addEdge('A', 'B');
      await addEdge('C', 'D');

      const result = await dataFlowPathHandler.trace(
        { source: 'A', sink: 'D' },
        storage,
      );

      expect(result.variant).toBe('noPath');
    });

    it('traces a direct source-to-sink path', async () => {
      await addEdge('A', 'B');

      const result = await dataFlowPathHandler.trace(
        { source: 'A', sink: 'B' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const paths = JSON.parse(result.paths as string);
      expect(paths.length).toBe(1);
      expect(paths[0].steps).toEqual(['A', 'B']);
      expect(paths[0].id).toBe('data-flow-path-1');
    });

    it('traces a multi-hop path', async () => {
      await addEdge('A', 'B');
      await addEdge('B', 'C');
      await addEdge('C', 'D');

      const result = await dataFlowPathHandler.trace(
        { source: 'A', sink: 'D' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const paths = JSON.parse(result.paths as string);
      expect(paths.length).toBe(1);
      expect(paths[0].steps).toEqual(['A', 'B', 'C', 'D']);
    });

    it('discovers multiple alternative paths', async () => {
      await addEdge('A', 'B');
      await addEdge('A', 'C');
      await addEdge('B', 'D');
      await addEdge('C', 'D');

      const result = await dataFlowPathHandler.trace(
        { source: 'A', sink: 'D' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const paths = JSON.parse(result.paths as string);
      expect(paths.length).toBe(2);
    });

    it('infers taint path kind for user-input sources', async () => {
      await addEdge('user-input', 'handler');

      const result = await dataFlowPathHandler.trace(
        { source: 'user-input', sink: 'handler' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const paths = JSON.parse(result.paths as string);
      expect(paths[0].pathKind).toBe('taint');
    });

    it('infers config-propagation path kind for config/ source', async () => {
      await addEdge('config/db-url', 'connection-pool');

      const result = await dataFlowPathHandler.trace(
        { source: 'config/db-url', sink: 'connection-pool' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const paths = JSON.parse(result.paths as string);
      expect(paths[0].pathKind).toBe('config-propagation');
    });

    it('infers output-derivation path kind for output sinks', async () => {
      await addEdge('compute', 'render.output');

      const result = await dataFlowPathHandler.trace(
        { source: 'compute', sink: 'render.output' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const paths = JSON.parse(result.paths as string);
      expect(paths[0].pathKind).toBe('output-derivation');
    });

    it('stores discovered paths and retrieves them via get', async () => {
      await addEdge('X', 'Y');

      await dataFlowPathHandler.trace({ source: 'X', sink: 'Y' }, storage);

      const getResult = await dataFlowPathHandler.get(
        { path: 'data-flow-path-1' },
        storage,
      );

      expect(getResult.variant).toBe('ok');
      expect(getResult.sourceSymbol).toBe('X');
      expect(getResult.sinkSymbol).toBe('Y');
      expect(getResult.stepCount).toBe(2);
    });

    it('avoids cycles when tracing paths', async () => {
      await addEdge('A', 'B');
      await addEdge('B', 'A'); // Cycle
      await addEdge('B', 'C');

      const result = await dataFlowPathHandler.trace(
        { source: 'A', sink: 'C' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const paths = JSON.parse(result.paths as string);
      expect(paths.length).toBe(1);
      expect(paths[0].steps).toEqual(['A', 'B', 'C']);
    });
  });

  // ----------------------------------------------------------
  // traceFromConfig action
  // ----------------------------------------------------------

  describe('traceFromConfig', () => {
    it('traces all paths from a config key through the graph', async () => {
      await addEdge('config/api-key', 'auth-service');
      await addEdge('auth-service', 'request-handler');

      const result = await dataFlowPathHandler.traceFromConfig(
        { configKey: 'api-key' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const paths = JSON.parse(result.paths as string);
      expect(paths.length).toBeGreaterThan(0);
    });

    it('returns empty paths when config key has no edges', async () => {
      const result = await dataFlowPathHandler.traceFromConfig(
        { configKey: 'nonexistent' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const paths = JSON.parse(result.paths as string);
      expect(paths.length).toBe(0);
    });

    it('handles config key already prefixed with config/', async () => {
      await addEdge('config/db-url', 'pool');

      const result = await dataFlowPathHandler.traceFromConfig(
        { configKey: 'config/db-url' },
        storage,
      );

      expect(result.variant).toBe('ok');
    });
  });

  // ----------------------------------------------------------
  // traceToOutput action
  // ----------------------------------------------------------

  describe('traceToOutput', () => {
    it('traces backward from output to all contributing sources', async () => {
      await addEdge('model', 'transform');
      await addEdge('transform', 'view.output');

      const result = await dataFlowPathHandler.traceToOutput(
        { output: 'view.output' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const paths = JSON.parse(result.paths as string);
      expect(paths.length).toBeGreaterThan(0);
    });

    it('returns empty paths when output has no predecessors', async () => {
      const result = await dataFlowPathHandler.traceToOutput(
        { output: 'orphan-output' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const paths = JSON.parse(result.paths as string);
      expect(paths.length).toBe(0);
    });

    it('identifies multiple sources feeding into an output', async () => {
      await addEdge('sourceA', 'merge');
      await addEdge('sourceB', 'merge');
      await addEdge('merge', 'final-output');

      const result = await dataFlowPathHandler.traceToOutput(
        { output: 'final-output' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const paths = JSON.parse(result.paths as string);
      // Both sourceA and sourceB should appear as roots
      expect(paths.length).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // get action
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns notfound for a nonexistent path', async () => {
      const result = await dataFlowPathHandler.get(
        { path: 'nonexistent' },
        storage,
      );

      expect(result.variant).toBe('notfound');
    });

    it('returns all stored fields for a traced path', async () => {
      await addEdge('user-input', 'handler');
      await addEdge('handler', 'db');

      await dataFlowPathHandler.trace(
        { source: 'user-input', sink: 'db' },
        storage,
      );

      const result = await dataFlowPathHandler.get(
        { path: 'data-flow-path-1' },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.path).toBe('data-flow-path-1');
      expect(result.sourceSymbol).toBe('user-input');
      expect(result.sinkSymbol).toBe('db');
      expect(result.pathKind).toBe('taint');
      expect(result.stepCount).toBe(3);
    });
  });
});
