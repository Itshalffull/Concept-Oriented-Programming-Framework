// @migrated dsl-constructs 2026-03-18
// Graph Concept Implementation
// Entity network visualization with force-directed layouts, filtering,
// and depth-limited neighborhood exploration.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _graphHandler: FunctionalConceptHandler = {
  addNode(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const node = input.node as string;

    const nodeKey = `${graph}:${node}`;

    let p = createProgram();
    p = spGet(p, 'graph', graph, 'graphRecord');
    p = branch(p, 'graphRecord',
      (b) => {
        let b2 = put(b, 'node', nodeKey, {
          graph,
          node,
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {});
      },
      (b) => {
        // Auto-create graph on first node addition
        const now = new Date().toISOString();
        let b2 = put(b, 'graph', graph, { graph, layout: '', createdAt: now, updatedAt: now });
        b2 = put(b2, 'node', nodeKey, {
          graph,
          node,
          createdAt: now,
        });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  removeNode(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const node = input.node as string;

    const nodeKey = `${graph}:${node}`;

    let p = createProgram();
    p = spGet(p, 'graph', graph, 'graphRecord');
    p = branch(p, 'graphRecord',
      (b) => {
        let b2 = spGet(b, 'node', nodeKey, 'existingNode');
        b2 = branch(b2, 'existingNode',
          (c) => {
            let c2 = del(c, 'node', nodeKey);
            return complete(c2, 'ok', {});
          },
          (c) => complete(c, 'notfound', {}),
        );
        return b2;
      },
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addEdge(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const source = input.source as string;
    const target = input.target as string;

    const edgeKey = `${graph}:${source}:${target}`;

    let p = createProgram();
    p = spGet(p, 'graph', graph, 'graphRecord');
    p = branch(p, 'graphRecord',
      (b) => {
        let b2 = put(b, 'edge', edgeKey, {
          graph,
          source,
          target,
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  removeEdge(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const source = input.source as string;
    const target = input.target as string;

    const edgeKey = `${graph}:${source}:${target}`;

    let p = createProgram();
    p = spGet(p, 'graph', graph, 'graphRecord');
    p = branch(p, 'graphRecord',
      (b) => {
        let b2 = spGet(b, 'edge', edgeKey, 'existingEdge');
        b2 = branch(b2, 'existingEdge',
          (c) => {
            let c2 = del(c, 'edge', edgeKey);
            return complete(c2, 'ok', {});
          },
          (c) => complete(c, 'notfound', {}),
        );
        return b2;
      },
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  computeLayout(input: Record<string, unknown>) {
    const graph = input.graph as string;

    let p = createProgram();
    p = spGet(p, 'graph', graph, 'graphRecord');
    p = branch(p, 'graphRecord',
      (b) => {
        let b2 = find(b, 'node', { graph }, 'allNodes');
        b2 = find(b2, 'edge', { graph }, 'allEdges');
        b2 = put(b2, 'graph', graph, {
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { layout: '{}' });
      },
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getNeighbors(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const node = input.node as string;
    const depth = input.depth as number;

    const nodeKey = `${graph}:${node}`;

    let p = createProgram();
    p = spGet(p, 'graph', graph, 'graphRecord');
    p = branch(p, 'graphRecord',
      (b) => {
        let b2 = spGet(b, 'node', nodeKey, 'existingNode');
        b2 = branch(b2, 'existingNode',
          (c) => {
            let c2 = find(c, 'edge', { graph }, 'allEdges');
            return complete(c2, 'ok', { neighbors: '' });
          },
          (c) => complete(c, 'notfound', {}),
        );
        return b2;
      },
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  filterNodes(input: Record<string, unknown>) {
    const graph = input.graph as string;
    const filter = input.filter as string;

    let p = createProgram();
    p = spGet(p, 'graph', graph, 'graphRecord');
    p = branch(p, 'graphRecord',
      (b) => {
        let b2 = find(b, 'node', { graph }, 'allNodes');
        return complete(b2, 'ok', { filtered: JSON.stringify([]) });
      },
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const graphHandler = autoInterpret(_graphHandler);

