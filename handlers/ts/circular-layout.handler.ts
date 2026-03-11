// ============================================================
// CircularLayout Handler
//
// Compute spatial positions by arranging items in a circle.
// Distributes items evenly around a central point with
// configurable radius. Best for peer relationships and rings.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const circularLayoutHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, _storage: ConceptStorage) {
    return { variant: 'ok', name: 'circular', category: 'layout' };
  },

  async apply(input: Record<string, unknown>, _storage: ConceptStorage) {
    const canvas = input.canvas as string;
    const items = (input.items as string[]) ?? [];

    if (!canvas) {
      return { variant: 'error', message: 'Canvas identifier is required' };
    }

    // Compute circular positions: distribute at equal angular intervals
    const radius = 200;
    const positions = items.map((item: string, index: number) => {
      const angle = (2 * Math.PI * index) / Math.max(items.length, 1);
      const x = Math.round(Math.cos(angle) * radius);
      const y = Math.round(Math.sin(angle) * radius);
      return JSON.stringify({ item, x, y });
    });

    return { variant: 'ok', positions };
  },
};

export default circularLayoutHandler;
