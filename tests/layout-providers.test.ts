// Layout provider handler tests -- tree-layout, radial-layout, constraint-layout register and apply actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { treeLayoutHandler } from '../handlers/ts/tree-layout.handler.js';
import { radialLayoutHandler } from '../handlers/ts/radial-layout.handler.js';
import { constraintLayoutHandler } from '../handlers/ts/constraint-layout.handler.js';

/** Wrap in-memory storage with a `list` method used by constraint-layout handler. */
function createTestStorage() {
  const base = createInMemoryStorage();
  return Object.assign(base, {
    async list(relation: string) {
      return base.find(relation);
    },
  });
}

describe('Layout Providers', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
  });

  describe('TreeLayout', () => {
    describe('register', () => {
      it('returns ok with name and category', async () => {
        const result = await treeLayoutHandler.register({}, storage);
        expect(result.variant).toBe('ok');
        expect(result.name).toBe('tree');
        expect(result.category).toBe('layout');
      });

      it('is idempotent', async () => {
        const r1 = await treeLayoutHandler.register({}, storage);
        const r2 = await treeLayoutHandler.register({}, storage);
        expect(r1.variant).toBe('ok');
        expect(r2.variant).toBe('ok');
        expect(r1.name).toBe(r2.name);
      });
    });

    describe('apply', () => {
      it('returns error for empty items', async () => {
        const result = await treeLayoutHandler.apply({ canvas: 'c1', items: [] }, storage);
        expect(result.variant).toBe('error');
      });

      it('positions root at origin with children below (top-to-bottom)', async () => {
        const result = await treeLayoutHandler.apply(
          { canvas: 'c1', items: ['root', 'child-a', 'child-b'] },
          storage,
        );
        expect(result.variant).toBe('ok');
        expect(result.positions).toHaveLength(3);
        expect(result.positions[0]).toEqual({ item_id: 'root', x: 0, y: 0 });
        // Children should be at y = spacingY (100 default)
        expect(result.positions[1].y).toBe(100);
        expect(result.positions[2].y).toBe(100);
      });

      it('supports left-to-right direction', async () => {
        const result = await treeLayoutHandler.apply(
          { canvas: 'c1', items: ['root', 'child-a'], config: { direction: 'left-to-right' } },
          storage,
        );
        expect(result.variant).toBe('ok');
        expect(result.positions[0]).toEqual({ item_id: 'root', x: 0, y: 0 });
        // Child should be at x = spacingX (80 default)
        expect(result.positions[1].x).toBe(80);
      });

      it('handles single item', async () => {
        const result = await treeLayoutHandler.apply(
          { canvas: 'c1', items: ['only'] },
          storage,
        );
        expect(result.variant).toBe('ok');
        expect(result.positions).toHaveLength(1);
        expect(result.positions[0]).toEqual({ item_id: 'only', x: 0, y: 0 });
      });

      it('uses custom spacing', async () => {
        const result = await treeLayoutHandler.apply(
          { canvas: 'c1', items: ['root', 'child'], config: { spacing_x: 200, spacing_y: 150 } },
          storage,
        );
        expect(result.variant).toBe('ok');
        expect(result.positions[1].y).toBe(150);
      });
    });
  });

  describe('RadialLayout', () => {
    describe('register', () => {
      it('returns ok with name and category', async () => {
        const result = await radialLayoutHandler.register({}, storage);
        expect(result.variant).toBe('ok');
        expect(result.name).toBe('radial');
        expect(result.category).toBe('layout');
      });

      it('is idempotent', async () => {
        const r1 = await radialLayoutHandler.register({}, storage);
        const r2 = await radialLayoutHandler.register({}, storage);
        expect(r1.name).toBe(r2.name);
      });
    });

    describe('apply', () => {
      it('returns error for empty items', async () => {
        const result = await radialLayoutHandler.apply({ canvas: 'c1', items: [] }, storage);
        expect(result.variant).toBe('error');
      });

      it('places root at center with children on a circle', async () => {
        const result = await radialLayoutHandler.apply(
          { canvas: 'c1', items: ['root', 'child-a', 'child-b', 'child-c'] },
          storage,
        );
        expect(result.variant).toBe('ok');
        expect(result.positions).toHaveLength(4);
        expect(result.positions[0]).toEqual({ item_id: 'root', x: 0, y: 0 });

        // Children should be at distance spacingX (120 default) from center
        for (let i = 1; i < result.positions.length; i++) {
          const pos = result.positions[i];
          const dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
          expect(dist).toBeCloseTo(120, 0);
        }
      });

      it('handles single item', async () => {
        const result = await radialLayoutHandler.apply(
          { canvas: 'c1', items: ['only'] },
          storage,
        );
        expect(result.variant).toBe('ok');
        expect(result.positions).toHaveLength(1);
        expect(result.positions[0]).toEqual({ item_id: 'only', x: 0, y: 0 });
      });

      it('uses custom spacing as radius', async () => {
        const result = await radialLayoutHandler.apply(
          { canvas: 'c1', items: ['root', 'child-a'], config: { spacing_x: 200 } },
          storage,
        );
        expect(result.variant).toBe('ok');
        const childPos = result.positions[1];
        const dist = Math.sqrt(childPos.x * childPos.x + childPos.y * childPos.y);
        expect(dist).toBeCloseTo(200, 0);
      });
    });
  });

  describe('ConstraintLayout', () => {
    describe('register', () => {
      it('returns ok with name and category', async () => {
        const result = await constraintLayoutHandler.register({}, storage);
        expect(result.variant).toBe('ok');
        expect(result.name).toBe('constraint');
        expect(result.category).toBe('layout');
      });

      it('is idempotent', async () => {
        const r1 = await constraintLayoutHandler.register({}, storage);
        const r2 = await constraintLayoutHandler.register({}, storage);
        expect(r1.name).toBe(r2.name);
      });
    });

    describe('apply', () => {
      it('returns error for empty items', async () => {
        const result = await constraintLayoutHandler.apply({ canvas: 'c1', items: [] }, storage);
        expect(result.variant).toBe('error');
      });

      it('lays out items in a grid when no constraints exist', async () => {
        const result = await constraintLayoutHandler.apply(
          { canvas: 'c1', items: ['a', 'b', 'c', 'd'] },
          storage,
        );
        expect(result.variant).toBe('ok');
        expect(result.positions).toHaveLength(4);
      });

      it('respects pinned constraints', async () => {
        // Create a pin constraint via storage directly
        await storage.put('constraint-anchor', 'pin-1', {
          id: 'pin-1',
          canvas_id: 'c1',
          anchor_type: 'pin',
          target_items: ['item-b'],
          parameters: { x: 500, y: 300, gap: null, axis: null, direction: null },
        });

        const result = await constraintLayoutHandler.apply(
          { canvas: 'c1', items: ['item-a', 'item-b', 'item-c'] },
          storage,
        );
        expect(result.variant).toBe('ok');

        const pinnedPos = result.positions.find(
          (p: { item_id: string }) => p.item_id === 'item-b',
        );
        expect(pinnedPos!.x).toBe(500);
        expect(pinnedPos!.y).toBe(300);
      });

      it('non-pinned items get grid positions', async () => {
        const result = await constraintLayoutHandler.apply(
          { canvas: 'c1', items: ['a', 'b'] },
          storage,
        );
        expect(result.variant).toBe('ok');
        // With default spacingX=100, first item at col 0, second at col 1
        expect(result.positions[0]).toMatchObject({ item_id: 'a', x: 0, y: 0 });
        expect(result.positions[1]).toMatchObject({ item_id: 'b', x: 100, y: 0 });
      });

      it('handles single item', async () => {
        const result = await constraintLayoutHandler.apply(
          { canvas: 'c1', items: ['solo'] },
          storage,
        );
        expect(result.variant).toBe('ok');
        expect(result.positions).toHaveLength(1);
        expect(result.positions[0]).toMatchObject({ item_id: 'solo', x: 0, y: 0 });
      });
    });
  });
});
