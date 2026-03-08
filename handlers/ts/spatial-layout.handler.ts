// ============================================================
// SpatialLayout Handler
//
// Automatic layout algorithms for canvas elements. Layout
// providers are registered with named algorithms, and apply
// dispatches to the registered provider.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

export const spatialLayoutHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const algorithm = input.algorithm as string;
    const provider = input.provider as string;

    await storage.put('layout_algorithm', algorithm, {
      algorithm,
      provider,
    });

    return { variant: 'ok' };
  },

  async apply(input: Record<string, unknown>, storage: ConceptStorage) {
    const algorithm = input.algorithm as string;

    const record = await storage.get('layout_algorithm', algorithm);
    if (!record) {
      return { variant: 'unknown_algorithm', message: `Algorithm '${algorithm}' is not registered` };
    }

    return { variant: 'ok', provider: record.provider };
  },
};

export default spatialLayoutHandler;
