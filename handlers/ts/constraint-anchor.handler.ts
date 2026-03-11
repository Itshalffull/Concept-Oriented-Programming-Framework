// ============================================================
// ConstraintAnchor Handler
//
// User-placed spatial constraints that layout algorithms must
// respect. Supports pin, alignment, separation, and flow
// direction constraints for hybrid manual+automatic layout.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `anchor-${++idCounter}`;
}

const VALID_AXES = ['x', 'y'];
const VALID_DIRECTIONS = ['top-to-bottom', 'left-to-right', 'bottom-to-top', 'right-to-left'];

export const constraintAnchorHandler: ConceptHandler = {
  async pin(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const itemId = input.item_id as string;
    const x = input.x as number;
    const y = input.y as number;

    const id = nextId();
    await storage.put('constraint-anchor', id, {
      id,
      anchor: id,
      canvas_id: canvasId,
      anchor_type: 'pin',
      target_items: [itemId],
      parameters: { x, y, gap: null, axis: null, direction: null },
    });

    return { variant: 'ok', anchor: id };
  },

  async align(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const itemIds = input.item_ids as string[];
    const axis = input.axis as string;

    if (!itemIds || itemIds.length < 2) {
      return { variant: 'error', message: 'At least 2 items required for alignment' };
    }
    if (!VALID_AXES.includes(axis)) {
      return { variant: 'error', message: `Invalid axis '${axis}'. Must be 'x' or 'y'` };
    }

    const id = nextId();
    await storage.put('constraint-anchor', id, {
      id,
      anchor: id,
      canvas_id: canvasId,
      anchor_type: axis === 'x' ? 'align_v' : 'align_h',
      target_items: itemIds,
      parameters: { x: null, y: null, gap: null, axis, direction: null },
    });

    return { variant: 'ok', anchor: id };
  },

  async separate(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const itemA = input.item_a as string;
    const itemB = input.item_b as string;
    const gap = input.gap as number;

    const id = nextId();
    await storage.put('constraint-anchor', id, {
      id,
      anchor: id,
      canvas_id: canvasId,
      anchor_type: 'separate',
      target_items: [itemA, itemB],
      parameters: { x: null, y: null, gap, axis: null, direction: null },
    });

    return { variant: 'ok', anchor: id };
  },

  async setFlowDirection(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const itemIds = input.item_ids as string[];
    const direction = input.direction as string;

    const id = nextId();
    await storage.put('constraint-anchor', id, {
      id,
      anchor: id,
      canvas_id: canvasId,
      anchor_type: 'flow_direction',
      target_items: itemIds,
      parameters: { x: null, y: null, gap: null, axis: null, direction },
    });

    return { variant: 'ok', anchor: id };
  },

  async removeAnchor(input: Record<string, unknown>, storage: ConceptStorage) {
    const anchorId = input.anchor as string;
    const record = await storage.get('constraint-anchor', anchorId);
    if (!record) {
      return { variant: 'notfound', message: `Anchor '${anchorId}' not found` };
    }
    await storage.del('constraint-anchor', anchorId);
    return { variant: 'ok', anchor: anchorId };
  },

  async getAnchorsForCanvas(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const all = await storage.list('constraint-anchor');
    const anchors = all.filter((a: Record<string, unknown>) => a.canvas_id === canvasId);
    return { variant: 'ok', anchors: anchors.map((a: Record<string, unknown>) => a.id) };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetConstraintAnchorCounter(): void {
  idCounter = 0;
}

export default constraintAnchorHandler;
