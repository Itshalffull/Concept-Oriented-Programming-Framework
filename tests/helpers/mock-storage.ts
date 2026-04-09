// Mock storage helper for generated view invariant tests.
// Creates an in-memory storage pre-seeded with minimal ViewShell
// and child spec records so ViewAnalysis can compile and analyze.

import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import type { ConceptStorage } from '../../runtime/types.js';

/**
 * Create an in-memory storage suitable for view invariant testing.
 * The storage is empty — test setup should seed it with the
 * ViewShell record and any child specs needed for the view
 * being analyzed.
 */
export function createMockStorage(): ConceptStorage {
  return createInMemoryStorage();
}
