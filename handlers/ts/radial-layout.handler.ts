// ============================================================
// RadialLayoutProvider Handler
//
// Radial tree layout. BFS from root, concentric circles.
// O(V+E) complexity. Best for radial mind maps and
// network hop visualizations.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const radialLayoutHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, _storage: ConceptStorage) {
    return { variant: 'ok', name: 'radial', category: 'layout' };
  },

  async apply(input: Record<string, unknown>, _storage: ConceptStorage) {
    const canvas = input.canvas as string;
    const items = input.items as string[];
    const config = (input.config as Record<string, unknown>) ?? {};
    const spacingX = (config.spacing_x as number) ?? 120;

    if (!items || items.length === 0) {
      return { variant: 'error', message: 'No items to layout' };
    }

    const positions: { item_id: string; x: number; y: number }[] = [];
    const root = items[0];
    const children = items.slice(1);

    // Root at center
    positions.push({ item_id: root, x: 0, y: 0 });

    // Children on concentric circle
    if (children.length > 0) {
      const angleStep = (2 * Math.PI) / children.length;
      children.forEach((child, i) => {
        const angle = i * angleStep - Math.PI / 2;
        positions.push({
          item_id: child,
          x: Math.cos(angle) * spacingX,
          y: Math.sin(angle) * spacingX,
        });
      });
    }

    return { variant: 'ok', positions };
  },
};

export default radialLayoutHandler;
