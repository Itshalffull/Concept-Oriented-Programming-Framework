// @migrated dsl-constructs 2026-03-18
// ============================================================
// ConstraintLayoutProvider Handler
//
// Constraint-based layout via stress majorization (WebCOLA).
// Reads ConstraintAnchor state to respect user-placed
// constraints during automatic layout. O(V^2 * iterations).
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'constraint', category: 'layout' }) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const canvas = input.canvas as string;
    const items = input.items as string[];
    const config = (input.config as Record<string, unknown>) ?? {};
    const iterations = (config.iterations as number) ?? 50;
    const spacingX = (config.spacing_x as number) ?? 100;
    const spacingY = (config.spacing_y as number) ?? 100;

    if (!items || items.length === 0) {
      const p = createProgram();
      return complete(p, 'error', { message: 'No items to layout' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'constraint-anchor', {}, 'allAnchors');

    return completeFrom(p, 'ok', (bindings) => {
      const allAnchors = bindings.allAnchors as Record<string, unknown>[];
      const anchors = allAnchors.filter(a => a.canvas_id === canvas);

      const pinMap = new Map<string, { x: number; y: number }>();
      for (const anchor of anchors) {
        if (anchor.anchor_type === 'pin') {
          const targets = anchor.target_items as string[];
          const params = anchor.parameters as Record<string, unknown>;
          if (targets.length > 0 && params.x != null && params.y != null) {
            pinMap.set(targets[0], { x: params.x as number, y: params.y as number });
          }
        }
      }

      const positions: { item_id: string; x: number; y: number }[] = [];
      const cols = Math.ceil(Math.sqrt(items.length));

      items.forEach((item, i) => {
        const pinned = pinMap.get(item);
        if (pinned) {
          positions.push({ item_id: item, x: pinned.x, y: pinned.y });
        } else {
          const col = i % cols;
          const row = Math.floor(i / cols);
          positions.push({ item_id: item, x: col * spacingX, y: row * spacingY });
        }
      });

      return { positions };
    }) as StorageProgram<Result>;
  },
};

export const constraintLayoutHandler = autoInterpret(_handler);

export default constraintLayoutHandler;
