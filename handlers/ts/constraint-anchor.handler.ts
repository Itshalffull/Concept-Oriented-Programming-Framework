// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ConstraintAnchor Handler
//
// User-placed spatial constraints that layout algorithms must
// respect. Supports pin, alignment, separation, and flow
// direction constraints for hybrid manual+automatic layout.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `anchor-${++idCounter}`;
}

const VALID_AXES = ['x', 'y'];
const VALID_DIRECTIONS = ['top-to-bottom', 'left-to-right', 'bottom-to-top', 'right-to-left'];

const _handler: FunctionalConceptHandler = {
  pin(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;
    const itemId = input.item_id as string;
    const x = input.x as number;
    const y = input.y as number;

    const id = nextId();
    let p = createProgram();
    p = put(p, 'constraint-anchor', id, {
      id,
      anchor: id,
      canvas_id: canvasId,
      anchor_type: 'pin',
      target_items: [itemId],
      parameters: { x, y, gap: null, axis: null, direction: null },
    });

    return complete(p, 'ok', { anchor: id }) as StorageProgram<Result>;
  },

  align(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;
    const itemIds = input.item_ids as string[];
    const axis = input.axis as string;

    if (!itemIds || itemIds.length < 2) {
      const p = createProgram();
      return complete(p, 'error', { message: 'At least 2 items required for alignment' }) as StorageProgram<Result>;
    }
    if (!VALID_AXES.includes(axis)) {
      const p = createProgram();
      return complete(p, 'error', { message: `Invalid axis '${axis}'. Must be 'x' or 'y'` }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'constraint-anchor', id, {
      id,
      anchor: id,
      canvas_id: canvasId,
      anchor_type: axis === 'x' ? 'align_v' : 'align_h',
      target_items: itemIds,
      parameters: { x: null, y: null, gap: null, axis, direction: null },
    });

    return complete(p, 'ok', { anchor: id }) as StorageProgram<Result>;
  },

  separate(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;
    const itemA = input.item_a as string;
    const itemB = input.item_b as string;
    const gap = input.gap as number;

    const id = nextId();
    let p = createProgram();
    p = put(p, 'constraint-anchor', id, {
      id,
      anchor: id,
      canvas_id: canvasId,
      anchor_type: 'separate',
      target_items: [itemA, itemB],
      parameters: { x: null, y: null, gap, axis: null, direction: null },
    });

    return complete(p, 'ok', { anchor: id }) as StorageProgram<Result>;
  },

  setFlowDirection(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;
    const itemIds = input.item_ids as string[];
    const direction = input.direction as string;

    const id = nextId();
    let p = createProgram();
    p = put(p, 'constraint-anchor', id, {
      id,
      anchor: id,
      canvas_id: canvasId,
      anchor_type: 'flow_direction',
      target_items: itemIds,
      parameters: { x: null, y: null, gap: null, axis: null, direction },
    });

    return complete(p, 'ok', { anchor: id }) as StorageProgram<Result>;
  },

  removeAnchor(input: Record<string, unknown>) {
    const anchorId = input.anchor as string;

    let p = createProgram();
    p = get(p, 'constraint-anchor', anchorId, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = del(thenP, 'constraint-anchor', anchorId);
        return complete(thenP, 'ok', { anchor: anchorId });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Anchor '${anchorId}' not found` }),
    ) as StorageProgram<Result>;
  },

  getAnchorsForCanvas(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;

    let p = createProgram();
    p = find(p, 'constraint-anchor', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      const anchors = all.filter(a => a.canvas_id === canvasId);
      return { anchors: anchors.map(a => a.id) };
    }) as StorageProgram<Result>;
  },
};

export const constraintAnchorHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetConstraintAnchorCounter(): void {
  idCounter = 0;
}

export default constraintAnchorHandler;
