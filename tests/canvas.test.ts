// Canvas concept handler tests -- addNode, moveNode, connectNodes, groupNodes, embedFile actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { canvasHandler } from '../handlers/ts/app/canvas.handler.js';

/** Wrap in-memory storage with a `list` method used by diagramming handlers. */
function createTestStorage() {
  const base = createInMemoryStorage();
  return Object.assign(base, {
    async list(relation: string) {
      return base.find(relation);
    },
  });
}

describe('Canvas', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
  });

  describe('addNode', () => {
    it('adds a node to a new canvas', async () => {
      const result = await canvasHandler.addNode(
        { canvas: 'canvas-1', node: 'node-a', x: 100, y: 200 },
        storage,
      );
      expect(result.variant).toBe('ok');

      const record = await storage.get('canvas', 'canvas-1');
      expect(record).not.toBeNull();

      const nodes = JSON.parse(record!.nodes as string);
      expect(nodes).toContain('node-a');

      const positions = JSON.parse(record!.positions as string);
      expect(positions['node-a']).toEqual({ x: 100, y: 200 });
    });

    it('auto-creates canvas on first node addition', async () => {
      await canvasHandler.addNode(
        { canvas: 'new-canvas', node: 'n1', x: 0, y: 0 },
        storage,
      );
      const record = await storage.get('canvas', 'new-canvas');
      expect(record).not.toBeNull();
    });

    it('adds multiple nodes to the same canvas', async () => {
      await canvasHandler.addNode({ canvas: 'c1', node: 'n1', x: 0, y: 0 }, storage);
      await canvasHandler.addNode({ canvas: 'c1', node: 'n2', x: 100, y: 100 }, storage);

      const record = await storage.get('canvas', 'c1');
      const nodes = JSON.parse(record!.nodes as string);
      expect(nodes).toEqual(['n1', 'n2']);

      const positions = JSON.parse(record!.positions as string);
      expect(positions['n1']).toEqual({ x: 0, y: 0 });
      expect(positions['n2']).toEqual({ x: 100, y: 100 });
    });

    it('preserves existing edges when adding a node', async () => {
      await canvasHandler.connectNodes({ canvas: 'c1', from: 'a', to: 'b' }, storage);
      await canvasHandler.addNode({ canvas: 'c1', node: 'c', x: 50, y: 50 }, storage);

      const record = await storage.get('canvas', 'c1');
      const edges = JSON.parse(record!.edges as string);
      expect(edges).toHaveLength(1);
      expect(edges[0]).toEqual({ from: 'a', to: 'b' });
    });
  });

  describe('moveNode', () => {
    it('repositions an existing node', async () => {
      await canvasHandler.addNode({ canvas: 'c1', node: 'n1', x: 0, y: 0 }, storage);

      const result = await canvasHandler.moveNode(
        { canvas: 'c1', node: 'n1', x: 200, y: 300 },
        storage,
      );
      expect(result.variant).toBe('ok');

      const record = await storage.get('canvas', 'c1');
      const positions = JSON.parse(record!.positions as string);
      expect(positions['n1']).toEqual({ x: 200, y: 300 });
    });

    it('returns notfound for non-existent canvas', async () => {
      const result = await canvasHandler.moveNode(
        { canvas: 'missing', node: 'n1', x: 0, y: 0 },
        storage,
      );
      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('Canvas not found');
    });

    it('returns notfound for non-existent node', async () => {
      await canvasHandler.addNode({ canvas: 'c1', node: 'n1', x: 0, y: 0 }, storage);

      const result = await canvasHandler.moveNode(
        { canvas: 'c1', node: 'missing', x: 0, y: 0 },
        storage,
      );
      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('Node not found');
    });

    it('updates position without affecting other nodes', async () => {
      await canvasHandler.addNode({ canvas: 'c1', node: 'n1', x: 0, y: 0 }, storage);
      await canvasHandler.addNode({ canvas: 'c1', node: 'n2', x: 50, y: 50 }, storage);

      await canvasHandler.moveNode({ canvas: 'c1', node: 'n1', x: 999, y: 888 }, storage);

      const record = await storage.get('canvas', 'c1');
      const positions = JSON.parse(record!.positions as string);
      expect(positions['n1']).toEqual({ x: 999, y: 888 });
      expect(positions['n2']).toEqual({ x: 50, y: 50 });
    });
  });

  describe('connectNodes', () => {
    it('creates an edge between two nodes', async () => {
      await canvasHandler.addNode({ canvas: 'c1', node: 'a', x: 0, y: 0 }, storage);
      await canvasHandler.addNode({ canvas: 'c1', node: 'b', x: 100, y: 100 }, storage);

      const result = await canvasHandler.connectNodes(
        { canvas: 'c1', from: 'a', to: 'b' },
        storage,
      );
      expect(result.variant).toBe('ok');

      const record = await storage.get('canvas', 'c1');
      const edges = JSON.parse(record!.edges as string);
      expect(edges).toHaveLength(1);
      expect(edges[0]).toEqual({ from: 'a', to: 'b' });
    });

    it('auto-creates canvas on connect', async () => {
      const result = await canvasHandler.connectNodes(
        { canvas: 'new-c', from: 'x', to: 'y' },
        storage,
      );
      expect(result.variant).toBe('ok');

      const record = await storage.get('canvas', 'new-c');
      expect(record).not.toBeNull();
    });

    it('auto-adds missing nodes to canvas', async () => {
      await canvasHandler.connectNodes({ canvas: 'c1', from: 'a', to: 'b' }, storage);

      const record = await storage.get('canvas', 'c1');
      const nodes = JSON.parse(record!.nodes as string);
      expect(nodes).toContain('a');
      expect(nodes).toContain('b');

      const positions = JSON.parse(record!.positions as string);
      expect(positions['a']).toEqual({ x: 0, y: 0 });
      expect(positions['b']).toEqual({ x: 0, y: 0 });
    });

    it('adds multiple edges', async () => {
      await canvasHandler.connectNodes({ canvas: 'c1', from: 'a', to: 'b' }, storage);
      await canvasHandler.connectNodes({ canvas: 'c1', from: 'b', to: 'c' }, storage);

      const record = await storage.get('canvas', 'c1');
      const edges = JSON.parse(record!.edges as string);
      expect(edges).toHaveLength(2);
    });

    it('does not duplicate existing nodes when connecting', async () => {
      await canvasHandler.addNode({ canvas: 'c1', node: 'a', x: 10, y: 20 }, storage);
      await canvasHandler.connectNodes({ canvas: 'c1', from: 'a', to: 'b' }, storage);

      const record = await storage.get('canvas', 'c1');
      const nodes = JSON.parse(record!.nodes as string) as string[];
      const aCount = nodes.filter((n) => n === 'a').length;
      expect(aCount).toBe(1);
    });
  });

  describe('groupNodes', () => {
    it('groups existing nodes', async () => {
      await canvasHandler.addNode({ canvas: 'c1', node: 'n1', x: 0, y: 0 }, storage);
      await canvasHandler.addNode({ canvas: 'c1', node: 'n2', x: 50, y: 50 }, storage);

      const result = await canvasHandler.groupNodes(
        { canvas: 'c1', nodes: JSON.stringify(['n1', 'n2']), group: 'g1' },
        storage,
      );
      expect(result.variant).toBe('ok');

      const record = await storage.get('canvas', 'c1');
      const groups = JSON.parse((record as Record<string, unknown>).groups as string);
      expect(groups['g1']).toEqual(['n1', 'n2']);
    });

    it('returns notfound for non-existent canvas', async () => {
      const result = await canvasHandler.groupNodes(
        { canvas: 'missing', nodes: JSON.stringify(['n1']), group: 'g1' },
        storage,
      );
      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('Canvas not found');
    });

    it('returns notfound when a node does not exist on canvas', async () => {
      await canvasHandler.addNode({ canvas: 'c1', node: 'n1', x: 0, y: 0 }, storage);

      const result = await canvasHandler.groupNodes(
        { canvas: 'c1', nodes: JSON.stringify(['n1', 'missing']), group: 'g1' },
        storage,
      );
      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('missing');
    });

    it('creates multiple groups on the same canvas', async () => {
      await canvasHandler.addNode({ canvas: 'c1', node: 'n1', x: 0, y: 0 }, storage);
      await canvasHandler.addNode({ canvas: 'c1', node: 'n2', x: 50, y: 50 }, storage);
      await canvasHandler.addNode({ canvas: 'c1', node: 'n3', x: 100, y: 100 }, storage);

      await canvasHandler.groupNodes({ canvas: 'c1', nodes: JSON.stringify(['n1']), group: 'g1' }, storage);
      await canvasHandler.groupNodes({ canvas: 'c1', nodes: JSON.stringify(['n2', 'n3']), group: 'g2' }, storage);

      const record = await storage.get('canvas', 'c1');
      const groups = JSON.parse((record as Record<string, unknown>).groups as string);
      expect(groups['g1']).toEqual(['n1']);
      expect(groups['g2']).toEqual(['n2', 'n3']);
    });
  });

  describe('embedFile', () => {
    it('embeds a file into an existing node', async () => {
      await canvasHandler.addNode({ canvas: 'c1', node: 'n1', x: 0, y: 0 }, storage);

      const result = await canvasHandler.embedFile(
        { canvas: 'c1', node: 'n1', file: '/path/to/file.md' },
        storage,
      );
      expect(result.variant).toBe('ok');

      const record = await storage.get('canvas', 'c1');
      const embeds = JSON.parse((record as Record<string, unknown>).embeds as string);
      expect(embeds['n1']).toBe('/path/to/file.md');
    });

    it('returns notfound for non-existent canvas', async () => {
      const result = await canvasHandler.embedFile(
        { canvas: 'missing', node: 'n1', file: 'f.txt' },
        storage,
      );
      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('Canvas not found');
    });

    it('returns notfound for non-existent node', async () => {
      await canvasHandler.addNode({ canvas: 'c1', node: 'n1', x: 0, y: 0 }, storage);

      const result = await canvasHandler.embedFile(
        { canvas: 'c1', node: 'missing', file: 'f.txt' },
        storage,
      );
      expect(result.variant).toBe('notfound');
      expect(result.message).toContain('Node not found');
    });

    it('overwrites previous embed for the same node', async () => {
      await canvasHandler.addNode({ canvas: 'c1', node: 'n1', x: 0, y: 0 }, storage);

      await canvasHandler.embedFile({ canvas: 'c1', node: 'n1', file: 'old.md' }, storage);
      await canvasHandler.embedFile({ canvas: 'c1', node: 'n1', file: 'new.md' }, storage);

      const record = await storage.get('canvas', 'c1');
      const embeds = JSON.parse((record as Record<string, unknown>).embeds as string);
      expect(embeds['n1']).toBe('new.md');
    });
  });

  describe('multi-step sequences', () => {
    it('addNode -> moveNode -> verify position updated', async () => {
      await canvasHandler.addNode({ canvas: 'c1', node: 'n1', x: 10, y: 20 }, storage);
      await canvasHandler.moveNode({ canvas: 'c1', node: 'n1', x: 300, y: 400 }, storage);

      const record = await storage.get('canvas', 'c1');
      const positions = JSON.parse(record!.positions as string);
      expect(positions['n1']).toEqual({ x: 300, y: 400 });
    });

    it('addNode -> connectNodes -> groupNodes -> embedFile', async () => {
      await canvasHandler.addNode({ canvas: 'c1', node: 'a', x: 0, y: 0 }, storage);
      await canvasHandler.addNode({ canvas: 'c1', node: 'b', x: 100, y: 0 }, storage);
      await canvasHandler.connectNodes({ canvas: 'c1', from: 'a', to: 'b' }, storage);
      await canvasHandler.groupNodes({ canvas: 'c1', nodes: JSON.stringify(['a', 'b']), group: 'pair' }, storage);
      await canvasHandler.embedFile({ canvas: 'c1', node: 'a', file: 'readme.md' }, storage);

      const record = await storage.get('canvas', 'c1');
      const nodes = JSON.parse(record!.nodes as string);
      expect(nodes).toEqual(['a', 'b']);

      const edges = JSON.parse(record!.edges as string);
      expect(edges).toHaveLength(1);

      const groups = JSON.parse((record as Record<string, unknown>).groups as string);
      expect(groups['pair']).toEqual(['a', 'b']);

      const embeds = JSON.parse((record as Record<string, unknown>).embeds as string);
      expect(embeds['a']).toBe('readme.md');
    });

    it('connectNodes auto-creates then moveNode repositions', async () => {
      await canvasHandler.connectNodes({ canvas: 'c1', from: 'x', to: 'y' }, storage);

      // Both nodes were auto-added at (0,0)
      const before = await storage.get('canvas', 'c1');
      const posBefore = JSON.parse(before!.positions as string);
      expect(posBefore['x']).toEqual({ x: 0, y: 0 });

      // Move the auto-created node
      await canvasHandler.moveNode({ canvas: 'c1', node: 'x', x: 500, y: 600 }, storage);
      const after = await storage.get('canvas', 'c1');
      const posAfter = JSON.parse(after!.positions as string);
      expect(posAfter['x']).toEqual({ x: 500, y: 600 });
      expect(posAfter['y']).toEqual({ x: 0, y: 0 });
    });
  });
});
