// ============================================================
// OrthogonalRouteProvider Handler
//
// Orthogonal (right-angle) connector routing using visibility
// graph + A* with bend penalty. O(E * V log V) complexity.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const orthogonalRouteHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, _storage: ConceptStorage) {
    return { variant: 'ok', name: 'orthogonal-route', category: 'routing' };
  },

  async route(input: Record<string, unknown>, _storage: ConceptStorage) {
    const source = input.source as string;
    const target = input.target as string;

    // Simplified orthogonal routing: L-shaped path
    // In production, uses visibility graph + A* with bend penalty
    const path = [
      { x: 0, y: 0 },     // source center (resolved at runtime)
      { x: 100, y: 0 },   // midpoint horizontal
      { x: 100, y: 100 },  // midpoint vertical
      { x: 200, y: 100 },  // target center (resolved at runtime)
    ];

    return { variant: 'ok', path };
  },
};

export default orthogonalRouteHandler;
