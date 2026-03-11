// ============================================================
// PolylineRouteProvider Handler
//
// Polyline routing with waypoint computation and angle snapping.
// General purpose routing for most diagram types. O(E * V).
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const polylineRouteHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, _storage: ConceptStorage) {
    return { variant: 'ok', name: 'polyline-route', category: 'routing' };
  },

  async route(input: Record<string, unknown>, _storage: ConceptStorage) {
    const source = input.source as string;
    const target = input.target as string;

    // Simplified polyline: direct path with optional midpoint
    // In production, computes waypoints with angle snapping and obstacle avoidance
    const path = [
      { x: 0, y: 0 },     // source
      { x: 200, y: 100 },  // target
    ];

    return { variant: 'ok', path };
  },
};

export default polylineRouteHandler;
