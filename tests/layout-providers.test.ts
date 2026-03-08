// Layout provider handler tests — ForceDirected, Hierarchical, Grid, Circular.
// Each provider computes spatial positions for canvas items using a different algorithm.

import { describe, it, expect } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { forceDirectedLayoutHandler } from '../handlers/ts/force-directed-layout.handler.js';
import { hierarchicalLayoutHandler } from '../handlers/ts/hierarchical-layout.handler.js';
import { gridLayoutHandler } from '../handlers/ts/grid-layout.handler.js';
import { circularLayoutHandler } from '../handlers/ts/circular-layout.handler.js';

describe('ForceDirectedLayout', () => {
  const storage = createInMemoryStorage();

  describe('register', () => {
    it('returns provider metadata', async () => {
      const result = await forceDirectedLayoutHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('force-directed');
      expect(result.category).toBe('layout');
    });
  });

  describe('apply', () => {
    it('computes positions for items', async () => {
      const result = await forceDirectedLayoutHandler.apply(
        { canvas: 'c1', items: ['a', 'b', 'c'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.positions).toHaveLength(3);
      // Each position is a JSON string with item, x, y
      const parsed = (result.positions as string[]).map((p: string) => JSON.parse(p));
      expect(parsed[0].item).toBe('a');
      expect(parsed[1].item).toBe('b');
      expect(parsed[2].item).toBe('c');
      expect(typeof parsed[0].x).toBe('number');
      expect(typeof parsed[0].y).toBe('number');
    });

    it('handles empty items list', async () => {
      const result = await forceDirectedLayoutHandler.apply(
        { canvas: 'c1', items: [] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.positions).toHaveLength(0);
    });

    it('returns error when canvas is missing', async () => {
      const result = await forceDirectedLayoutHandler.apply(
        { items: ['a'] },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('produces unique positions for different items', async () => {
      const result = await forceDirectedLayoutHandler.apply(
        { canvas: 'c1', items: ['a', 'b'] },
        storage,
      );
      const positions = (result.positions as string[]).map((p: string) => JSON.parse(p));
      const pos1 = `${positions[0].x},${positions[0].y}`;
      const pos2 = `${positions[1].x},${positions[1].y}`;
      expect(pos1).not.toBe(pos2);
    });
  });
});

describe('HierarchicalLayout', () => {
  const storage = createInMemoryStorage();

  describe('register', () => {
    it('returns provider metadata', async () => {
      const result = await hierarchicalLayoutHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('hierarchical');
      expect(result.category).toBe('layout');
    });
  });

  describe('apply', () => {
    it('computes layered positions', async () => {
      const result = await hierarchicalLayoutHandler.apply(
        { canvas: 'c1', items: ['root', 'child1', 'child2'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.positions).toHaveLength(3);
      const parsed = (result.positions as string[]).map((p: string) => JSON.parse(p));
      expect(parsed[0].item).toBe('root');
      // Items in same layer should have same y value
      expect(parsed[0].y).toBe(parsed[1].y);
      expect(parsed[0].y).toBe(parsed[2].y);
    });

    it('creates multiple layers for many items', async () => {
      const result = await hierarchicalLayoutHandler.apply(
        { canvas: 'c1', items: ['a', 'b', 'c', 'd', 'e'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      const parsed = (result.positions as string[]).map((p: string) => JSON.parse(p));
      // First 3 items in layer 0, items 4-5 in layer 1
      expect(parsed[0].y).toBe(0);
      expect(parsed[3].y).toBeGreaterThan(0);
    });

    it('returns error when canvas is missing', async () => {
      const result = await hierarchicalLayoutHandler.apply(
        { items: ['a'] },
        storage,
      );
      expect(result.variant).toBe('error');
    });
  });
});

describe('GridLayout', () => {
  const storage = createInMemoryStorage();

  describe('register', () => {
    it('returns provider metadata', async () => {
      const result = await gridLayoutHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('grid');
      expect(result.category).toBe('layout');
    });
  });

  describe('apply', () => {
    it('arranges items in a grid', async () => {
      const result = await gridLayoutHandler.apply(
        { canvas: 'c1', items: ['a', 'b', 'c', 'd'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.positions).toHaveLength(4);
      const parsed = (result.positions as string[]).map((p: string) => JSON.parse(p));
      // With 4 items, grid should be 2x2
      expect(parsed[0].x).toBe(0);
      expect(parsed[0].y).toBe(0);
      expect(parsed[1].x).toBeGreaterThan(0);
    });

    it('handles single item', async () => {
      const result = await gridLayoutHandler.apply(
        { canvas: 'c1', items: ['solo'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      const parsed = (result.positions as string[]).map((p: string) => JSON.parse(p));
      expect(parsed[0].item).toBe('solo');
      expect(parsed[0].x).toBe(0);
      expect(parsed[0].y).toBe(0);
    });

    it('returns error when canvas is missing', async () => {
      const result = await gridLayoutHandler.apply(
        { items: ['a'] },
        storage,
      );
      expect(result.variant).toBe('error');
    });
  });
});

describe('CircularLayout', () => {
  const storage = createInMemoryStorage();

  describe('register', () => {
    it('returns provider metadata', async () => {
      const result = await circularLayoutHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('circular');
      expect(result.category).toBe('layout');
    });
  });

  describe('apply', () => {
    it('distributes items around a circle', async () => {
      const result = await circularLayoutHandler.apply(
        { canvas: 'c1', items: ['a', 'b', 'c'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.positions).toHaveLength(3);
      const parsed = (result.positions as string[]).map((p: string) => JSON.parse(p));
      // All items should be at roughly the same distance from center
      const distances = parsed.map((p: { x: number; y: number }) => Math.sqrt(p.x ** 2 + p.y ** 2));
      expect(distances[0]).toBeCloseTo(distances[1], 0);
      expect(distances[1]).toBeCloseTo(distances[2], 0);
    });

    it('handles empty items list', async () => {
      const result = await circularLayoutHandler.apply(
        { canvas: 'c1', items: [] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.positions).toHaveLength(0);
    });

    it('returns error when canvas is missing', async () => {
      const result = await circularLayoutHandler.apply(
        { items: ['a'] },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('produces symmetric positions for 4 items', async () => {
      const result = await circularLayoutHandler.apply(
        { canvas: 'c1', items: ['n', 'e', 's', 'w'] },
        storage,
      );
      const parsed = (result.positions as string[]).map((p: string) => JSON.parse(p));
      // First item should be at (radius, 0) — east
      expect(parsed[0].x).toBe(200);
      expect(parsed[0].y).toBe(0);
    });
  });
});
