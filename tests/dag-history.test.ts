// DAGHistory concept handler tests -- append, ancestors, commonAncestor, descendants, between, getNode.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { dagHistoryHandler, resetDAGHistoryCounter } from '../implementations/typescript/dag-history.impl.js';

describe('DAGHistory', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetDAGHistoryCounter();
  });

  describe('append', () => {
    it('appends a root node with no parents', async () => {
      const result = await dagHistoryHandler.append(
        { parents: [], contentRef: 'hash-1', metadata: 'initial commit' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.nodeId).toBe('dag-history-1');
    });

    it('appends a child node referencing a parent', async () => {
      const root = await dagHistoryHandler.append({ parents: [], contentRef: 'h1', metadata: 'root' }, storage);
      const child = await dagHistoryHandler.append(
        { parents: [root.nodeId], contentRef: 'h2', metadata: 'child' },
        storage,
      );
      expect(child.variant).toBe('ok');
      expect(child.nodeId).toBe('dag-history-2');
    });

    it('returns unknownParent for non-existent parent', async () => {
      const result = await dagHistoryHandler.append(
        { parents: ['nonexistent'], contentRef: 'h1', metadata: 'orphan' },
        storage,
      );
      expect(result.variant).toBe('unknownParent');
    });

    it('supports merge nodes with multiple parents', async () => {
      const root = await dagHistoryHandler.append({ parents: [], contentRef: 'h1', metadata: 'root' }, storage);
      const a = await dagHistoryHandler.append({ parents: [root.nodeId], contentRef: 'h2', metadata: 'a' }, storage);
      const b = await dagHistoryHandler.append({ parents: [root.nodeId], contentRef: 'h3', metadata: 'b' }, storage);
      const merge = await dagHistoryHandler.append(
        { parents: [a.nodeId, b.nodeId], contentRef: 'h4', metadata: 'merge' },
        storage,
      );
      expect(merge.variant).toBe('ok');
    });
  });

  describe('getNode', () => {
    it('retrieves a node by ID', async () => {
      const created = await dagHistoryHandler.append({ parents: [], contentRef: 'h1', metadata: 'root' }, storage);
      const result = await dagHistoryHandler.getNode({ nodeId: created.nodeId as string }, storage);
      expect(result.variant).toBe('ok');
      expect(result.contentRef).toBe('h1');
      expect(result.metadata).toBe('root');
      expect(result.parents).toEqual([]);
    });

    it('returns notFound for unknown node', async () => {
      const result = await dagHistoryHandler.getNode({ nodeId: 'nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('ancestors', () => {
    it('returns empty array for root node', async () => {
      const root = await dagHistoryHandler.append({ parents: [], contentRef: 'h1', metadata: 'root' }, storage);
      const result = await dagHistoryHandler.ancestors({ nodeId: root.nodeId as string }, storage);
      expect(result.variant).toBe('ok');
      expect(result.nodes).toEqual([]);
    });

    it('returns ancestors in topological order', async () => {
      const root = await dagHistoryHandler.append({ parents: [], contentRef: 'h1', metadata: 'root' }, storage);
      const mid = await dagHistoryHandler.append({ parents: [root.nodeId], contentRef: 'h2', metadata: 'mid' }, storage);
      const leaf = await dagHistoryHandler.append({ parents: [mid.nodeId], contentRef: 'h3', metadata: 'leaf' }, storage);

      const result = await dagHistoryHandler.ancestors({ nodeId: leaf.nodeId as string }, storage);
      expect(result.variant).toBe('ok');
      const nodes = result.nodes as string[];
      expect(nodes).toContain(root.nodeId);
      expect(nodes).toContain(mid.nodeId as string);
      // Root should come before mid in topological order
      expect(nodes.indexOf(root.nodeId as string)).toBeLessThan(nodes.indexOf(mid.nodeId as string));
    });

    it('returns notFound for unknown node', async () => {
      const result = await dagHistoryHandler.ancestors({ nodeId: 'nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('commonAncestor', () => {
    it('finds the common ancestor of two divergent nodes', async () => {
      const root = await dagHistoryHandler.append({ parents: [], contentRef: 'h1', metadata: 'root' }, storage);
      const a = await dagHistoryHandler.append({ parents: [root.nodeId], contentRef: 'h2', metadata: 'a' }, storage);
      const b = await dagHistoryHandler.append({ parents: [root.nodeId], contentRef: 'h3', metadata: 'b' }, storage);

      const result = await dagHistoryHandler.commonAncestor(
        { a: a.nodeId as string, b: b.nodeId as string },
        storage,
      );
      expect(result.variant).toBe('found');
      expect(result.nodeId).toBe(root.nodeId);
    });

    it('returns none for disjoint DAGs', async () => {
      const a = await dagHistoryHandler.append({ parents: [], contentRef: 'h1', metadata: 'a' }, storage);
      const b = await dagHistoryHandler.append({ parents: [], contentRef: 'h2', metadata: 'b' }, storage);

      const result = await dagHistoryHandler.commonAncestor(
        { a: a.nodeId as string, b: b.nodeId as string },
        storage,
      );
      expect(result.variant).toBe('none');
    });

    it('returns notFound for unknown node', async () => {
      const a = await dagHistoryHandler.append({ parents: [], contentRef: 'h1', metadata: 'a' }, storage);
      const result = await dagHistoryHandler.commonAncestor(
        { a: a.nodeId as string, b: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('notFound');
    });
  });

  describe('descendants', () => {
    it('returns all descendants of a node', async () => {
      const root = await dagHistoryHandler.append({ parents: [], contentRef: 'h1', metadata: 'root' }, storage);
      const a = await dagHistoryHandler.append({ parents: [root.nodeId], contentRef: 'h2', metadata: 'a' }, storage);
      const b = await dagHistoryHandler.append({ parents: [root.nodeId], contentRef: 'h3', metadata: 'b' }, storage);

      const result = await dagHistoryHandler.descendants({ nodeId: root.nodeId as string }, storage);
      expect(result.variant).toBe('ok');
      const nodes = result.nodes as string[];
      expect(nodes).toContain(a.nodeId);
      expect(nodes).toContain(b.nodeId);
    });

    it('returns empty for leaf node', async () => {
      const root = await dagHistoryHandler.append({ parents: [], contentRef: 'h1', metadata: 'root' }, storage);
      const result = await dagHistoryHandler.descendants({ nodeId: root.nodeId as string }, storage);
      expect(result.variant).toBe('ok');
      expect(result.nodes).toEqual([]);
    });

    it('returns notFound for unknown node', async () => {
      const result = await dagHistoryHandler.descendants({ nodeId: 'nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('between', () => {
    it('finds path between two connected nodes', async () => {
      const root = await dagHistoryHandler.append({ parents: [], contentRef: 'h1', metadata: 'root' }, storage);
      const mid = await dagHistoryHandler.append({ parents: [root.nodeId], contentRef: 'h2', metadata: 'mid' }, storage);
      const leaf = await dagHistoryHandler.append({ parents: [mid.nodeId], contentRef: 'h3', metadata: 'leaf' }, storage);

      const result = await dagHistoryHandler.between(
        { from: root.nodeId as string, to: leaf.nodeId as string },
        storage,
      );
      expect(result.variant).toBe('ok');
      const path = result.path as string[];
      expect(path[0]).toBe(root.nodeId);
      expect(path[path.length - 1]).toBe(leaf.nodeId);
      expect(path.length).toBe(3);
    });

    it('returns noPath for disconnected nodes', async () => {
      const a = await dagHistoryHandler.append({ parents: [], contentRef: 'h1', metadata: 'a' }, storage);
      const b = await dagHistoryHandler.append({ parents: [], contentRef: 'h2', metadata: 'b' }, storage);

      const result = await dagHistoryHandler.between(
        { from: a.nodeId as string, to: b.nodeId as string },
        storage,
      );
      expect(result.variant).toBe('noPath');
    });

    it('returns notFound for unknown node', async () => {
      const result = await dagHistoryHandler.between({ from: 'nonexistent', to: 'also-nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });
});
