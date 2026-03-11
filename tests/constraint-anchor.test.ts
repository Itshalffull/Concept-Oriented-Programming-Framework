// ConstraintAnchor concept handler tests -- pin, align, separate, setFlowDirection,
// removeAnchor, and getAnchorsForCanvas actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { constraintAnchorHandler, resetConstraintAnchorCounter } from '../handlers/ts/constraint-anchor.handler.js';

/** Wrap in-memory storage with a `list` method used by diagramming handlers. */
function createTestStorage() {
  const base = createInMemoryStorage();
  return Object.assign(base, {
    async list(relation: string) {
      return base.find(relation);
    },
  });
}

describe('ConstraintAnchor', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
    resetConstraintAnchorCounter();
  });

  describe('pin', () => {
    it('creates a pin constraint with correct fields', async () => {
      const result = await constraintAnchorHandler.pin(
        { canvas_id: 'canvas-1', item_id: 'node-1', x: 100, y: 200 },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.anchor).toBe('anchor-1');

      const record = await storage.get('constraint-anchor', 'anchor-1');
      expect(record!.canvas_id).toBe('canvas-1');
      expect(record!.anchor_type).toBe('pin');
      expect(record!.target_items).toEqual(['node-1']);
      expect(record!.parameters).toEqual({ x: 100, y: 200, gap: null, axis: null, direction: null });
    });

    it('assigns unique IDs', async () => {
      const r1 = await constraintAnchorHandler.pin({ canvas_id: 'c1', item_id: 'n1', x: 0, y: 0 }, storage);
      const r2 = await constraintAnchorHandler.pin({ canvas_id: 'c1', item_id: 'n2', x: 50, y: 50 }, storage);
      expect(r1.anchor).not.toBe(r2.anchor);
    });

    it('stores the anchor id in the record', async () => {
      const result = await constraintAnchorHandler.pin({ canvas_id: 'c1', item_id: 'n1', x: 10, y: 20 }, storage);
      const record = await storage.get('constraint-anchor', result.anchor as string);
      expect(record!.anchor).toBe(result.anchor);
      expect(record!.id).toBe(result.anchor);
    });

    it('pins with zero coordinates', async () => {
      const result = await constraintAnchorHandler.pin({ canvas_id: 'c1', item_id: 'n1', x: 0, y: 0 }, storage);
      expect(result.variant).toBe('ok');
      const record = await storage.get('constraint-anchor', result.anchor as string);
      expect((record!.parameters as Record<string, unknown>).x).toBe(0);
      expect((record!.parameters as Record<string, unknown>).y).toBe(0);
    });

    it('pins with negative coordinates', async () => {
      const result = await constraintAnchorHandler.pin({ canvas_id: 'c1', item_id: 'n1', x: -50, y: -100 }, storage);
      expect(result.variant).toBe('ok');
      const record = await storage.get('constraint-anchor', result.anchor as string);
      expect((record!.parameters as Record<string, unknown>).x).toBe(-50);
    });
  });

  describe('align', () => {
    it('creates an alignment constraint for x axis', async () => {
      const result = await constraintAnchorHandler.align(
        { canvas_id: 'canvas-1', item_ids: ['n1', 'n2', 'n3'], axis: 'x' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.anchor).toBe('anchor-1');

      const record = await storage.get('constraint-anchor', 'anchor-1');
      expect(record!.anchor_type).toBe('align_v');
      expect(record!.target_items).toEqual(['n1', 'n2', 'n3']);
      expect((record!.parameters as Record<string, unknown>).axis).toBe('x');
    });

    it('creates an alignment constraint for y axis', async () => {
      const result = await constraintAnchorHandler.align(
        { canvas_id: 'canvas-1', item_ids: ['n1', 'n2'], axis: 'y' },
        storage,
      );
      expect(result.variant).toBe('ok');

      const record = await storage.get('constraint-anchor', result.anchor as string);
      expect(record!.anchor_type).toBe('align_h');
    });

    it('returns error for fewer than 2 items', async () => {
      const result = await constraintAnchorHandler.align(
        { canvas_id: 'canvas-1', item_ids: ['n1'], axis: 'x' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('At least 2 items');
    });

    it('returns error for empty item list', async () => {
      const result = await constraintAnchorHandler.align(
        { canvas_id: 'canvas-1', item_ids: [], axis: 'x' },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('returns error for invalid axis', async () => {
      const result = await constraintAnchorHandler.align(
        { canvas_id: 'canvas-1', item_ids: ['n1', 'n2'], axis: 'z' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('Invalid axis');
    });

    it('returns error for null item_ids', async () => {
      const result = await constraintAnchorHandler.align(
        { canvas_id: 'canvas-1', item_ids: null, axis: 'x' },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('stores canvas_id correctly', async () => {
      const result = await constraintAnchorHandler.align(
        { canvas_id: 'my-canvas', item_ids: ['a', 'b'], axis: 'x' },
        storage,
      );
      const record = await storage.get('constraint-anchor', result.anchor as string);
      expect(record!.canvas_id).toBe('my-canvas');
    });
  });

  describe('separate', () => {
    it('creates a separation constraint with gap', async () => {
      const result = await constraintAnchorHandler.separate(
        { canvas_id: 'canvas-1', item_a: 'n1', item_b: 'n2', gap: 50 },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.anchor).toBe('anchor-1');

      const record = await storage.get('constraint-anchor', 'anchor-1');
      expect(record!.anchor_type).toBe('separate');
      expect(record!.target_items).toEqual(['n1', 'n2']);
      expect((record!.parameters as Record<string, unknown>).gap).toBe(50);
    });

    it('stores gap of zero', async () => {
      const result = await constraintAnchorHandler.separate(
        { canvas_id: 'c1', item_a: 'a', item_b: 'b', gap: 0 },
        storage,
      );
      const record = await storage.get('constraint-anchor', result.anchor as string);
      expect((record!.parameters as Record<string, unknown>).gap).toBe(0);
    });

    it('stores large gap values', async () => {
      const result = await constraintAnchorHandler.separate(
        { canvas_id: 'c1', item_a: 'a', item_b: 'b', gap: 1000 },
        storage,
      );
      const record = await storage.get('constraint-anchor', result.anchor as string);
      expect((record!.parameters as Record<string, unknown>).gap).toBe(1000);
    });

    it('has null for unused parameters', async () => {
      const result = await constraintAnchorHandler.separate(
        { canvas_id: 'c1', item_a: 'a', item_b: 'b', gap: 25 },
        storage,
      );
      const record = await storage.get('constraint-anchor', result.anchor as string);
      const params = record!.parameters as Record<string, unknown>;
      expect(params.x).toBeNull();
      expect(params.y).toBeNull();
      expect(params.axis).toBeNull();
      expect(params.direction).toBeNull();
    });
  });

  describe('setFlowDirection', () => {
    it('creates a flow direction constraint', async () => {
      const result = await constraintAnchorHandler.setFlowDirection(
        { canvas_id: 'canvas-1', item_ids: ['n1', 'n2', 'n3'], direction: 'top-to-bottom' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.anchor).toBe('anchor-1');

      const record = await storage.get('constraint-anchor', 'anchor-1');
      expect(record!.anchor_type).toBe('flow_direction');
      expect(record!.target_items).toEqual(['n1', 'n2', 'n3']);
      expect((record!.parameters as Record<string, unknown>).direction).toBe('top-to-bottom');
    });

    it('stores left-to-right direction', async () => {
      const result = await constraintAnchorHandler.setFlowDirection(
        { canvas_id: 'c1', item_ids: ['a', 'b'], direction: 'left-to-right' },
        storage,
      );
      const record = await storage.get('constraint-anchor', result.anchor as string);
      expect((record!.parameters as Record<string, unknown>).direction).toBe('left-to-right');
    });

    it('stores bottom-to-top direction', async () => {
      const result = await constraintAnchorHandler.setFlowDirection(
        { canvas_id: 'c1', item_ids: ['a', 'b'], direction: 'bottom-to-top' },
        storage,
      );
      const record = await storage.get('constraint-anchor', result.anchor as string);
      expect((record!.parameters as Record<string, unknown>).direction).toBe('bottom-to-top');
    });

    it('stores right-to-left direction', async () => {
      const result = await constraintAnchorHandler.setFlowDirection(
        { canvas_id: 'c1', item_ids: ['a', 'b'], direction: 'right-to-left' },
        storage,
      );
      const record = await storage.get('constraint-anchor', result.anchor as string);
      expect((record!.parameters as Record<string, unknown>).direction).toBe('right-to-left');
    });

    it('has null for unused parameters', async () => {
      const result = await constraintAnchorHandler.setFlowDirection(
        { canvas_id: 'c1', item_ids: ['a'], direction: 'top-to-bottom' },
        storage,
      );
      const record = await storage.get('constraint-anchor', result.anchor as string);
      const params = record!.parameters as Record<string, unknown>;
      expect(params.x).toBeNull();
      expect(params.y).toBeNull();
      expect(params.gap).toBeNull();
      expect(params.axis).toBeNull();
    });
  });

  describe('removeAnchor', () => {
    it('removes an existing anchor', async () => {
      const created = await constraintAnchorHandler.pin(
        { canvas_id: 'c1', item_id: 'n1', x: 10, y: 20 },
        storage,
      );
      const id = created.anchor as string;

      const result = await constraintAnchorHandler.removeAnchor({ anchor: id }, storage);
      expect(result.variant).toBe('ok');
      expect(result.anchor).toBe(id);

      const record = await storage.get('constraint-anchor', id);
      expect(record).toBeNull();
    });

    it('returns notfound for missing anchor', async () => {
      const result = await constraintAnchorHandler.removeAnchor({ anchor: 'nonexistent' }, storage);
      expect(result.variant).toBe('notfound');
    });

    it('removes alignment anchor', async () => {
      const created = await constraintAnchorHandler.align(
        { canvas_id: 'c1', item_ids: ['a', 'b'], axis: 'x' },
        storage,
      );

      const result = await constraintAnchorHandler.removeAnchor({ anchor: created.anchor }, storage);
      expect(result.variant).toBe('ok');
    });

    it('removes separation anchor', async () => {
      const created = await constraintAnchorHandler.separate(
        { canvas_id: 'c1', item_a: 'a', item_b: 'b', gap: 10 },
        storage,
      );

      const result = await constraintAnchorHandler.removeAnchor({ anchor: created.anchor }, storage);
      expect(result.variant).toBe('ok');
    });
  });

  describe('getAnchorsForCanvas', () => {
    it('returns anchors for a canvas', async () => {
      await constraintAnchorHandler.pin({ canvas_id: 'c1', item_id: 'n1', x: 0, y: 0 }, storage);
      await constraintAnchorHandler.pin({ canvas_id: 'c1', item_id: 'n2', x: 50, y: 50 }, storage);
      await constraintAnchorHandler.pin({ canvas_id: 'c2', item_id: 'n3', x: 100, y: 100 }, storage);

      const result = await constraintAnchorHandler.getAnchorsForCanvas({ canvas_id: 'c1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.anchors).toEqual(['anchor-1', 'anchor-2']);
    });

    it('returns empty array for unknown canvas', async () => {
      const result = await constraintAnchorHandler.getAnchorsForCanvas({ canvas_id: 'unknown' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.anchors).toEqual([]);
    });

    it('returns anchors of mixed types', async () => {
      await constraintAnchorHandler.pin({ canvas_id: 'c1', item_id: 'n1', x: 0, y: 0 }, storage);
      await constraintAnchorHandler.align({ canvas_id: 'c1', item_ids: ['n1', 'n2'], axis: 'x' }, storage);
      await constraintAnchorHandler.separate({ canvas_id: 'c1', item_a: 'n1', item_b: 'n2', gap: 20 }, storage);

      const result = await constraintAnchorHandler.getAnchorsForCanvas({ canvas_id: 'c1' }, storage);
      expect(result.anchors).toHaveLength(3);
    });

    it('does not include removed anchors', async () => {
      const p1 = await constraintAnchorHandler.pin({ canvas_id: 'c1', item_id: 'n1', x: 0, y: 0 }, storage);
      await constraintAnchorHandler.pin({ canvas_id: 'c1', item_id: 'n2', x: 50, y: 50 }, storage);
      await constraintAnchorHandler.removeAnchor({ anchor: p1.anchor }, storage);

      const result = await constraintAnchorHandler.getAnchorsForCanvas({ canvas_id: 'c1' }, storage);
      expect(result.anchors).toEqual(['anchor-2']);
    });
  });

  describe('multi-step sequences', () => {
    it('pin -> align -> separate -> getAnchorsForCanvas -> removeAnchor -> verify removed', async () => {
      // Pin
      const pinResult = await constraintAnchorHandler.pin(
        { canvas_id: 'c1', item_id: 'n1', x: 100, y: 200 },
        storage,
      );
      expect(pinResult.variant).toBe('ok');

      // Align
      const alignResult = await constraintAnchorHandler.align(
        { canvas_id: 'c1', item_ids: ['n1', 'n2'], axis: 'y' },
        storage,
      );
      expect(alignResult.variant).toBe('ok');

      // Separate
      const sepResult = await constraintAnchorHandler.separate(
        { canvas_id: 'c1', item_a: 'n2', item_b: 'n3', gap: 30 },
        storage,
      );
      expect(sepResult.variant).toBe('ok');

      // Get all anchors
      const allAnchors = await constraintAnchorHandler.getAnchorsForCanvas({ canvas_id: 'c1' }, storage);
      expect(allAnchors.anchors).toHaveLength(3);

      // Remove one
      await constraintAnchorHandler.removeAnchor({ anchor: alignResult.anchor }, storage);

      // Verify removed
      const afterRemove = await constraintAnchorHandler.getAnchorsForCanvas({ canvas_id: 'c1' }, storage);
      expect(afterRemove.anchors).toHaveLength(2);
      expect(afterRemove.anchors).not.toContain(alignResult.anchor);
    });

    it('create constraints on multiple canvases then query each', async () => {
      await constraintAnchorHandler.pin({ canvas_id: 'c1', item_id: 'n1', x: 0, y: 0 }, storage);
      await constraintAnchorHandler.align({ canvas_id: 'c2', item_ids: ['a', 'b'], axis: 'x' }, storage);
      await constraintAnchorHandler.setFlowDirection({ canvas_id: 'c1', item_ids: ['n1', 'n2'], direction: 'left-to-right' }, storage);

      const c1 = await constraintAnchorHandler.getAnchorsForCanvas({ canvas_id: 'c1' }, storage);
      const c2 = await constraintAnchorHandler.getAnchorsForCanvas({ canvas_id: 'c2' }, storage);

      expect(c1.anchors).toHaveLength(2);
      expect(c2.anchors).toHaveLength(1);
    });

    it('remove all anchors for a canvas', async () => {
      await constraintAnchorHandler.pin({ canvas_id: 'c1', item_id: 'n1', x: 0, y: 0 }, storage);
      await constraintAnchorHandler.pin({ canvas_id: 'c1', item_id: 'n2', x: 50, y: 50 }, storage);

      const initial = await constraintAnchorHandler.getAnchorsForCanvas({ canvas_id: 'c1' }, storage);
      for (const anchorId of initial.anchors as string[]) {
        await constraintAnchorHandler.removeAnchor({ anchor: anchorId }, storage);
      }

      const final = await constraintAnchorHandler.getAnchorsForCanvas({ canvas_id: 'c1' }, storage);
      expect(final.anchors).toEqual([]);
    });
  });
});
