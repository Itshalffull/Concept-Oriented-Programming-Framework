// ============================================================
// Cold Start Optimization for Serverless
//
// Strategies to minimize cold start latency when Clef concepts
// run on Lambda/GCF:
//
//   1. Pre-load compiled sync artifacts at module level
//      (outside the handler, executed once per container)
//   2. Pre-build sync index at module level for reuse
//      across warm invocations
//   3. Lazy-load concept handlers — only initialize the
//      handler for the concept this function serves
//   4. Cache compiled artifacts from .clef-cache/ in the
//      deployment package (not fetched at runtime)
// ============================================================

import type { CompiledSync } from '../../kernel/src/types.js';
import { buildSyncIndex } from '../../handlers/ts/framework/engine.js';
import type { SyncIndex } from '../../handlers/ts/framework/engine.js';

// --- Compiled Sync Cache ---

/** Cached compiled syncs, loaded once per execution context. */
let cachedSyncs: CompiledSync[] | null = null;

/** Cached sync index, built once per execution context. */
let cachedSyncIndex: SyncIndex | null = null;

/**
 * Load compiled syncs from bundled artifacts.
 * In production, these are bundled into the deployment package
 * from .clef-cache/compiled-syncs.json.
 *
 * This function is idempotent — subsequent calls return the
 * cached result without re-parsing.
 */
export function loadCompiledSyncs(artifacts: CompiledSync[]): CompiledSync[] {
  if (cachedSyncs) return cachedSyncs;
  cachedSyncs = artifacts;
  return cachedSyncs;
}

/**
 * Get or build the sync index from compiled syncs.
 * The index is a Map<string, Set<CompiledSync>> keyed by
 * "concept:action" — construction is fast (no parsing).
 */
export function getSyncIndex(syncs: CompiledSync[]): SyncIndex {
  if (cachedSyncIndex) return cachedSyncIndex;
  cachedSyncIndex = buildSyncIndex(syncs);
  return cachedSyncIndex;
}

/**
 * Invalidate the cached sync index (e.g., after hot reload).
 */
export function invalidateSyncCache(): void {
  cachedSyncs = null;
  cachedSyncIndex = null;
}

// --- Concept Handler Lazy Loading ---

/** Cache for lazy-loaded concept handlers. */
const handlerCache = new Map<string, unknown>();

/**
 * Lazy-load a concept handler by name.
 * Only initializes the handler for the concept this function
 * serves, avoiding unnecessary imports and setup.
 *
 * @param conceptName - The concept to load
 * @param loader - Factory function that creates the handler
 * @returns The handler (cached after first call)
 */
export function lazyLoadHandler<T>(
  conceptName: string,
  loader: () => T,
): T {
  let handler = handlerCache.get(conceptName) as T | undefined;
  if (!handler) {
    handler = loader();
    handlerCache.set(conceptName, handler);
  }
  return handler;
}

/**
 * Clear the handler cache (for tests).
 */
export function clearHandlerCache(): void {
  handlerCache.clear();
}

// --- Module-Level Initialization Pattern ---

/**
 * Create a module-level initializer that runs once per execution
 * context (Lambda container / GCF instance).
 *
 * Usage:
 *   const init = createModuleInitializer(async () => {
 *     const syncs = loadCompiledSyncs(bundledSyncs);
 *     const index = getSyncIndex(syncs);
 *     const storage = createDynamoDBStorage(client, config);
 *     return { syncs, index, storage };
 *   });
 *
 *   export const handler = async (event) => {
 *     const { storage, index } = await init();
 *     // ... handle event
 *   };
 */
export function createModuleInitializer<T>(
  factory: () => T | Promise<T>,
): () => Promise<T> {
  let cached: T | null = null;
  let pending: Promise<T> | null = null;

  return async (): Promise<T> => {
    if (cached) return cached;
    if (pending) return pending;

    pending = Promise.resolve(factory()).then(result => {
      cached = result;
      pending = null;
      return result;
    });

    return pending;
  };
}
