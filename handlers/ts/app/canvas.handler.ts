// @migrated dsl-constructs 2026-03-18
// Canvas Concept Implementation
import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

export const canvasHandler: ConceptHandler = {
  async addNode(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const canvas = input.canvas as string;
    const node = input.node as string;
    const x = input.x as number;
    const y = input.y as number;

    const existing = await storage.get('canvas', canvas);
    if (existing) {
      const nodes = JSON.parse(existing.nodes as string || '[]');
      const positions = JSON.parse(existing.positions as string || '{}');
      nodes.push(node);
      positions[node] = { x, y };
      await storage.put('canvas', canvas, {
        ...existing,
        nodes: JSON.stringify(nodes),
        positions: JSON.stringify(positions),
      });
    } else {
      await storage.put('canvas', canvas, {
        canvas,
        nodes: JSON.stringify([node]),
        positions: JSON.stringify({ [node]: { x, y } }),
        edges: '[]',
      });
    }
    return { variant: 'ok' };
  },

  async moveNode(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const canvas = input.canvas as string;
    const node = input.node as string;
    const x = input.x as number;
    const y = input.y as number;

    const existing = await storage.get('canvas', canvas);
    if (!existing) return { variant: 'notfound', message: 'Canvas not found' };

    const nodes = JSON.parse(existing.nodes as string || '[]');
    if (!nodes.includes(node)) return { variant: 'notfound', message: 'Node not found' };

    const positions = JSON.parse(existing.positions as string || '{}');
    positions[node] = { x, y };
    await storage.put('canvas', canvas, {
      ...existing,
      positions: JSON.stringify(positions),
    });
    return { variant: 'ok' };
  },

  async connectNodes(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const canvas = input.canvas as string;
    const from = input.from as string;
    const to = input.to as string;

    const existing = await storage.get('canvas', canvas);
    if (existing) {
      const nodes = JSON.parse(existing.nodes as string || '[]');
      const positions = JSON.parse(existing.positions as string || '{}');
      const edges = JSON.parse(existing.edges as string || '[]');
      if (!nodes.includes(from)) { nodes.push(from); positions[from] = { x: 0, y: 0 }; }
      if (!nodes.includes(to)) { nodes.push(to); positions[to] = { x: 0, y: 0 }; }
      edges.push({ from, to });
      await storage.put('canvas', canvas, {
        ...existing,
        nodes: JSON.stringify(nodes),
        positions: JSON.stringify(positions),
        edges: JSON.stringify(edges),
      });
    } else {
      await storage.put('canvas', canvas, {
        canvas,
        nodes: JSON.stringify([from, to]),
        positions: JSON.stringify({ [from]: { x: 0, y: 0 }, [to]: { x: 0, y: 0 } }),
        edges: JSON.stringify([{ from, to }]),
      });
    }
    return { variant: 'ok' };
  },

  async groupNodes(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const canvas = input.canvas as string;
    const nodeList = input.nodes as string;
    const group = input.group as string;

    const existing = await storage.get('canvas', canvas);
    if (!existing) return { variant: 'notfound', message: 'Canvas not found' };

    const nodes = JSON.parse(existing.nodes as string || '[]');
    const groups = JSON.parse(existing.groups as string || '{}');
    const requestedNodes = JSON.parse(nodeList || '[]');
    const missing = requestedNodes.filter((n: string) => !nodes.includes(n));
    if (missing.length > 0) return { variant: 'notfound', message: `Nodes missing: ${missing.join(', ')}` };

    groups[group] = requestedNodes;
    await storage.put('canvas', canvas, {
      ...existing,
      groups: JSON.stringify(groups),
    });
    return { variant: 'ok' };
  },

  async embedFile(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const canvas = input.canvas as string;
    const node = input.node as string;
    const file = input.file as string;

    const existing = await storage.get('canvas', canvas);
    if (!existing) return { variant: 'notfound', message: 'Canvas not found' };

    const nodes = JSON.parse(existing.nodes as string || '[]');
    if (!nodes.includes(node)) return { variant: 'notfound', message: 'Node not found' };

    const embeds = JSON.parse(existing.embeds as string || '{}');
    embeds[node] = file;
    await storage.put('canvas', canvas, {
      ...existing,
      embeds: JSON.stringify(embeds),
    });
    return { variant: 'ok' };
  },
};
