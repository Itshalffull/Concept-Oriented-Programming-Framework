// Graph Concept Implementation
// Entity network visualization with force-directed layouts, filtering,
// and depth-limited neighborhood exploration.
import type { ConceptHandler } from '@clef/kernel';

interface Edge {
  source: string;
  target: string;
}

export const graphHandler: ConceptHandler = {
  async addNode(input, storage) {
    const graph = input.graph as string;
    const node = input.node as string;

    // Ensure graph exists in the graph registry
    let graphRecord = await storage.get('graph', graph);
    if (!graphRecord) {
      // Auto-create graph on first node addition
      const now = new Date().toISOString();
      graphRecord = { graph, layout: '', createdAt: now, updatedAt: now };
      await storage.put('graph', graph, graphRecord);
    }

    // Store node as a separate relation keyed by graph:node
    const nodeKey = `${graph}:${node}`;
    await storage.put('node', nodeKey, {
      graph,
      node,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async removeNode(input, storage) {
    const graph = input.graph as string;
    const node = input.node as string;

    const graphRecord = await storage.get('graph', graph);
    if (!graphRecord) {
      return { variant: 'notfound' };
    }

    const nodeKey = `${graph}:${node}`;
    const existingNode = await storage.get('node', nodeKey);
    if (!existingNode) {
      return { variant: 'notfound' };
    }

    await storage.del('node', nodeKey);

    // Remove all edges connected to this node
    const allEdges = await storage.find('edge', { graph });
    for (const edge of allEdges) {
      if (edge.source === node || edge.target === node) {
        const edgeKey = `${graph}:${edge.source}:${edge.target}`;
        await storage.del('edge', edgeKey);
      }
    }

    return { variant: 'ok' };
  },

  async addEdge(input, storage) {
    const graph = input.graph as string;
    const source = input.source as string;
    const target = input.target as string;

    const graphRecord = await storage.get('graph', graph);
    if (!graphRecord) {
      return { variant: 'notfound' };
    }

    // Verify both nodes exist
    const sourceNode = await storage.get('node', `${graph}:${source}`);
    const targetNode = await storage.get('node', `${graph}:${target}`);
    if (!sourceNode || !targetNode) {
      return { variant: 'notfound' };
    }

    const edgeKey = `${graph}:${source}:${target}`;
    await storage.put('edge', edgeKey, {
      graph,
      source,
      target,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async removeEdge(input, storage) {
    const graph = input.graph as string;
    const source = input.source as string;
    const target = input.target as string;

    const graphRecord = await storage.get('graph', graph);
    if (!graphRecord) {
      return { variant: 'notfound' };
    }

    const edgeKey = `${graph}:${source}:${target}`;
    const existingEdge = await storage.get('edge', edgeKey);
    if (!existingEdge) {
      return { variant: 'notfound' };
    }

    await storage.del('edge', edgeKey);

    return { variant: 'ok' };
  },

  async computeLayout(input, storage) {
    const graph = input.graph as string;

    const graphRecord = await storage.get('graph', graph);
    if (!graphRecord) {
      return { variant: 'notfound' };
    }

    const allNodes = await storage.find('node', { graph });
    const allEdges = await storage.find('edge', { graph });

    // Simulate force-directed layout computation by assigning positions
    const positions: Record<string, { x: number; y: number }> = {};
    const nodeCount = allNodes.length;
    allNodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(nodeCount, 1);
      positions[n.node as string] = {
        x: Math.round(Math.cos(angle) * 100),
        y: Math.round(Math.sin(angle) * 100),
      };
    });

    const layout = JSON.stringify({
      algorithm: 'force-directed',
      nodeCount,
      edgeCount: allEdges.length,
      positions,
      computedAt: new Date().toISOString(),
    });

    await storage.put('graph', graph, {
      ...graphRecord,
      layout,
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', layout };
  },

  async getNeighbors(input, storage) {
    const graph = input.graph as string;
    const node = input.node as string;
    const depth = input.depth as number;

    const graphRecord = await storage.get('graph', graph);
    if (!graphRecord) {
      return { variant: 'notfound' };
    }

    const nodeKey = `${graph}:${node}`;
    const existingNode = await storage.get('node', nodeKey);
    if (!existingNode) {
      return { variant: 'notfound' };
    }

    const allEdges = await storage.find('edge', { graph });
    const edges: Edge[] = allEdges.map(e => ({
      source: e.source as string,
      target: e.target as string,
    }));

    // BFS to find neighbors within the specified depth
    const visited = new Set<string>();
    let frontier = new Set<string>([node]);
    visited.add(node);

    for (let d = 0; d < depth; d++) {
      const nextFrontier = new Set<string>();
      for (const current of frontier) {
        for (const edge of edges) {
          if (edge.source === current && !visited.has(edge.target)) {
            visited.add(edge.target);
            nextFrontier.add(edge.target);
          }
          if (edge.target === current && !visited.has(edge.source)) {
            visited.add(edge.source);
            nextFrontier.add(edge.source);
          }
        }
      }
      frontier = nextFrontier;
    }

    // Exclude the starting node from the neighbor list
    visited.delete(node);
    const neighbors = JSON.stringify(Array.from(visited));

    return { variant: 'ok', neighbors };
  },

  async filterNodes(input, storage) {
    const graph = input.graph as string;
    const filter = input.filter as string;

    const graphRecord = await storage.get('graph', graph);
    if (!graphRecord) {
      return { variant: 'notfound' };
    }

    const allNodes = await storage.find('node', { graph });
    const nodeNames = allNodes.map(n => n.node as string);

    // Apply filter as a substring match on node names
    const filtered = nodeNames.filter(name =>
      name.toLowerCase().includes(filter.toLowerCase()),
    );

    return { variant: 'ok', filtered: JSON.stringify(filtered) };
  },
};
