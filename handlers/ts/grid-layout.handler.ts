// ============================================================
// GridLayout Handler
//
// Compute spatial positions by arranging items in a uniform grid.
// Distributes items across rows and columns with configurable
// spacing. Best for collections and galleries.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const gridLayoutHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, _storage: ConceptStorage) {
    return { variant: 'ok', name: 'grid', category: 'layout' };
  },

  async apply(input: Record<string, unknown>, _storage: ConceptStorage) {
    const canvas = input.canvas as string;
    const items = (input.items as string[]) ?? [];

    if (!canvas) {
      return { variant: 'error', message: 'Canvas identifier is required' };
    }

    // Compute grid positions: arrange in rows with uniform cell sizing
    const columns = Math.max(Math.ceil(Math.sqrt(items.length)), 1);
    const cellWidth = 120;
    const cellHeight = 100;
    const positions = items.map((item: string, index: number) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = col * cellWidth;
      const y = row * cellHeight;
      return JSON.stringify({ item, x, y });
    });

    return { variant: 'ok', positions };
  },
};

export default gridLayoutHandler;
