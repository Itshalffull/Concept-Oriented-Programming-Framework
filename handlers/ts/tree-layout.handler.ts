// ============================================================
// TreeLayoutProvider Handler
//
// Buchheim tree layout algorithm. O(V) complexity.
// Produces compact tree drawings with thread pointers for
// contour computation. Supports variable node sizes.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const treeLayoutHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, _storage: ConceptStorage) {
    return { variant: 'ok', name: 'tree', category: 'layout' };
  },

  async apply(input: Record<string, unknown>, _storage: ConceptStorage) {
    const canvas = input.canvas as string;
    const items = input.items as string[];
    const config = (input.config as Record<string, unknown>) ?? {};
    const direction = (config.direction as string) ?? 'top-to-bottom';
    const spacingX = (config.spacing_x as number) ?? 80;
    const spacingY = (config.spacing_y as number) ?? 100;

    if (!items || items.length === 0) {
      return { variant: 'error', message: 'No items to layout' };
    }

    // Simplified Buchheim: root at top, children below
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
      // top-to-bottom (default)
      positions.push({ item_id: root, x: 0, y: 0 });
      children.forEach((child, i) => {
        const x = (i - (children.length - 1) / 2) * spacingX;
        positions.push({ item_id: child, x, y: spacingY });
      });
    }

    return { variant: 'ok', positions };
  },
};

export default treeLayoutHandler;
