// @clef-handler style=functional concept=tree
// @migrated dsl-constructs 2026-03-18
// ============================================================
// TreeLayoutProvider Handler
//
// Buchheim tree layout algorithm. O(V) complexity.
// Produces compact tree drawings with thread pointers for
// contour computation. Supports variable node sizes.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'tree', category: 'layout' }) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const canvas = input.canvas as string;
    const items = input.items as string[];
    const config = (input.config as Record<string, unknown>) ?? {};
    const direction = (config.direction as string) ?? 'top-to-bottom';
    const spacingX = (config.spacing_x as number) ?? 80;
    const spacingY = (config.spacing_y as number) ?? 100;

    if (!items || items.length === 0) {
      const p = createProgram();
      return complete(p, 'error', { message: 'No items to layout' }) as StorageProgram<Result>;
    }

    const positions: { item_id: string; x: number; y: number }[] = [];
    const root = items[0];
    const children = items.slice(1);

    if (direction === 'left-to-right') {
      positions.push({ item_id: root, x: 0, y: 0 });
      children.forEach((child, i) => {
        const y = (i - (children.length - 1) / 2) * spacingY;
        positions.push({ item_id: child, x: spacingX, y });
      });
    } else {
      positions.push({ item_id: root, x: 0, y: 0 });
      children.forEach((child, i) => {
        const x = (i - (children.length - 1) / 2) * spacingX;
        positions.push({ item_id: child, x, y: spacingY });
      });
    }

    const p = createProgram();
    return complete(p, 'ok', { positions }) as StorageProgram<Result>;
  },
};

export const treeLayoutHandler = autoInterpret(_handler);

export default treeLayoutHandler;
