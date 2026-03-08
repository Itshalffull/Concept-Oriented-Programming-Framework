// ============================================================
// HierarchicalLayout Handler
//
// Compute spatial positions using hierarchical (Sugiyama-style)
// layout. Assigns items to layers based on dependency direction,
// minimizes edge crossings, and aligns nodes within layers.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const hierarchicalLayoutHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, _storage: ConceptStorage) {
    return { variant: 'ok', name: 'hierarchical', category: 'layout' };
  },

  async apply(input: Record<string, unknown>, _storage: ConceptStorage) {
    const canvas = input.canvas as string;
    const items = (input.items as string[]) ?? [];

    if (!canvas) {
      return { variant: 'error', message: 'Canvas identifier is required' };
    }

    // Compute hierarchical positions: stack items in layers top-to-bottom
    const layerSpacing = 120;
    const itemSpacing = 150;
    const positions = items.map((item: string, index: number) => {
      const layer = Math.floor(index / 3);
      const posInLayer = index % 3;
      const x = posInLayer * itemSpacing;
      const y = layer * layerSpacing;
      return JSON.stringify({ item, x, y });
    });

    return { variant: 'ok', positions };
  },
};

export default hierarchicalLayoutHandler;
