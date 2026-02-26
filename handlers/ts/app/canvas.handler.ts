// Canvas Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const canvasHandler: ConceptHandler = {
  async addNode(input, storage) {
    const canvas = input.canvas as string;
    const node = input.node as string;
    const x = input.x as number;
    const y = input.y as number;

    const existing = await storage.get('canvas', canvas);
    if (!existing) {
      return { variant: 'notfound', message: 'Canvas not found' };
    }

    const nodes = JSON.parse((existing.nodes as string) || '[]') as string[];
    const positions = JSON.parse((existing.positions as string) || '{}') as Record<string, { x: number; y: number }>;

    nodes.push(node);
    positions[node] = { x, y };

    await storage.put('canvas', canvas, {
      ...existing,
      nodes: JSON.stringify(nodes),
      positions: JSON.stringify(positions),
    });

    return { variant: 'ok' };
  },

  async moveNode(input, storage) {
    const canvas = input.canvas as string;
    const node = input.node as string;
    const x = input.x as number;
    const y = input.y as number;

    const existing = await storage.get('canvas', canvas);
    if (!existing) {
      return { variant: 'notfound', message: 'Canvas not found' };
    }

    const nodes = JSON.parse((existing.nodes as string) || '[]') as string[];
    if (!nodes.includes(node)) {
      return { variant: 'notfound', message: 'Node not found on canvas' };
    }

    const positions = JSON.parse((existing.positions as string) || '{}') as Record<string, { x: number; y: number }>;
    positions[node] = { x, y };

    await storage.put('canvas', canvas, {
      ...existing,
      positions: JSON.stringify(positions),
    });

    return { variant: 'ok' };
  },

  async connectNodes(input, storage) {
    const canvas = input.canvas as string;
    const from = input.from as string;
    const to = input.to as string;

    const existing = await storage.get('canvas', canvas);
    if (!existing) {
      return { variant: 'notfound', message: 'Canvas not found' };
    }

    const nodes = JSON.parse((existing.nodes as string) || '[]') as string[];
    if (!nodes.includes(from) || !nodes.includes(to)) {
      return { variant: 'notfound', message: 'One or both nodes not found on canvas' };
    }

    const edges = JSON.parse((existing.edges as string) || '[]') as Array<{ from: string; to: string }>;
    edges.push({ from, to });

    await storage.put('canvas', canvas, {
      ...existing,
      edges: JSON.stringify(edges),
    });

    return { variant: 'ok' };
  },

  async groupNodes(input, storage) {
    const canvas = input.canvas as string;
    const nodeList = input.nodes as string;
    const group = input.group as string;

    const existing = await storage.get('canvas', canvas);
    if (!existing) {
      return { variant: 'notfound', message: 'Canvas not found' };
    }

    const allNodes = JSON.parse((existing.nodes as string) || '[]') as string[];
    const requestedNodes = JSON.parse(nodeList) as string[];

    for (const n of requestedNodes) {
      if (!allNodes.includes(n)) {
        return { variant: 'notfound', message: `Node "${n}" not found on canvas` };
      }
    }

    const groups = JSON.parse((existing as Record<string, unknown>).groups as string || '{}') as Record<string, string[]>;
    groups[group] = requestedNodes;

    await storage.put('canvas', canvas, {
      ...existing,
      groups: JSON.stringify(groups),
    });

    return { variant: 'ok' };
  },

  async embedFile(input, storage) {
    const canvas = input.canvas as string;
    const node = input.node as string;
    const file = input.file as string;

    const existing = await storage.get('canvas', canvas);
    if (!existing) {
      return { variant: 'notfound', message: 'Canvas not found' };
    }

    const nodes = JSON.parse((existing.nodes as string) || '[]') as string[];
    if (!nodes.includes(node)) {
      return { variant: 'notfound', message: 'Node not found on canvas' };
    }

    const embeds = JSON.parse((existing as Record<string, unknown>).embeds as string || '{}') as Record<string, string>;
    embeds[node] = file;

    await storage.put('canvas', canvas, {
      ...existing,
      embeds: JSON.stringify(embeds),
    });

    return { variant: 'ok' };
  },
};
