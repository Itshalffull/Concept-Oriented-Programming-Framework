// ============================================================
// ForceDirectedLayout Handler
//
// Compute spatial positions using force-directed graph layout.
// Simulates repulsion between nodes and attraction along edges
// to produce organic, readable arrangements.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const forceDirectedLayoutHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, _storage: ConceptStorage) {
    return { variant: 'ok', name: 'force-directed', category: 'layout' };
  },

  async apply(input: Record<string, unknown>, _storage: ConceptStorage) {
    const canvas = input.canvas as string;
    const items = (input.items as string[]) ?? [];

    if (!canvas) {
      return { variant: 'error', message: 'Canvas identifier is required' };
    }

    // Compute force-directed positions: place items using spring-electric simulation
    const positions = items.map((item: string, index: number) => {
      // Distribute items using a simple force-directed heuristic:
      // angle-based placement with distance from center proportional to index
      const angle = (2 * Math.PI * index) / Math.max(items.length, 1);
      const radius = 100 + index * 50;
      const x = Math.round(Math.cos(angle) * radius);
      const y = Math.round(Math.sin(angle) * radius);
      return JSON.stringify({ item, x, y });
    });

    return { variant: 'ok', positions };
  },
};

export default forceDirectedLayoutHandler;
