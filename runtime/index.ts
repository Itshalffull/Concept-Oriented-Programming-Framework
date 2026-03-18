// ============================================================
// Clef Kernel - Entry Point
//
// Pre-conceptual code only (Section 10.3):
//   - Message dispatch (self-hosted.ts)
//   - Transport adapter instantiation (transport.ts, http, ws)
//   - Storage primitives (storage.ts)
//   - Compiled artifact cache (cache.ts)
//
// Everything above this layer is spec-driven and self-hosting.
// ============================================================

// --- Storage ---
export { createInMemoryStorage } from './adapters/storage.js';
export { createFileStorage, compactAll } from './adapters/file-storage.js';
export type { FileStorageOptions } from './adapters/file-storage.js';
export { createStorageFactory, resolveStorageConfig } from './adapters/storage-factory.js';
export type { StorageFactoryConfig, StorageBackend, ResolvedStorageConfig } from './adapters/storage-factory.js';

// --- Transport adapters ---
export { createInProcessAdapter, createConceptRegistry } from './adapters/transport.js';
export { createHttpLiteAdapter, createHttpGraphQLAdapter, createHttpConceptServer } from './adapters/http-transport.js';
export type { HttpFetchFn } from './adapters/http-transport.js';
export { createWebSocketAdapter, createWebSocketConceptServer } from './adapters/ws-transport.js';
export type { WsMessage, MockWebSocket, WebSocketFactory } from './adapters/ws-transport.js';

// --- Message dispatch ---
export { createSelfHostedKernel } from './self-hosted.js';
export type { Kernel, FlowLog } from './self-hosted.js';

// --- Compiled artifact cache ---
export {
  computeFileHash, computeSourceHashes,
  writeCacheManifest, writeConceptManifest, writeCompiledSyncs, writeRegistrations,
  readCacheManifest, readConceptManifests, readAllCompiledSyncs, readRegistrations,
  validateCache, getCacheDir,
} from './cache.js';
export type { CacheManifest, RegistrationEntry } from './cache.js';

// --- Kernel types ---
export type {
  ConceptHandler, ConceptStorage, ConceptTransport, ConceptRegistry, ConceptQuery,
  ActionInvocation, ActionCompletion, ActionRecord,
  CompiledSync, ConceptManifest,
  EntryMeta, ConflictResolution, ConflictInfo,
  LiteQueryProtocol, LiteFilter, ConceptStateSnapshot,
} from './types.js';
export { generateId, timestamp } from './types.js';

// --- Functional handler support ---
export { interpret } from './interpreter.js';
export type { ExecutionResult } from './interpreter.js';
export { wrapFunctional } from './functional-compat.js';
