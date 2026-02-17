// ============================================================
// COPF Kernel - Entry Point
//
// The kernel contains only pre-conceptual code per Section 10.3:
//   - Message dispatch (self-hosted.ts)
//   - Transport adapter instantiation (transport.ts)
//   - Storage primitives (storage.ts)
//   - Compiled artifact cache (cache.ts)
//
// Everything above this layer is spec-driven and self-hosting.
// The SyncEngine, parsers, and code generators live in the
// concept implementations directory.
// ============================================================

// --- Pre-conceptual kernel exports ---

export { createInMemoryStorage } from './storage.js';
export { createInProcessAdapter, createConceptRegistry } from './transport.js';
export { createSelfHostedKernel } from './self-hosted.js';
export type { Kernel, FlowLog } from './self-hosted.js';

// HTTP transport adapters
export {
  createHttpLiteAdapter,
  createHttpGraphQLAdapter,
  createHttpConceptServer,
} from './http-transport.js';
export type {
  LiteFilter as HttpLiteFilter,
  ConceptStateSnapshot as HttpConceptStateSnapshot,
  HttpFetchFn,
} from './http-transport.js';

// WebSocket transport
export {
  createWebSocketAdapter,
  createWebSocketConceptServer,
} from './ws-transport.js';
export type {
  WsMessage,
  MockWebSocket,
  WebSocketFactory,
} from './ws-transport.js';

// Compiled artifact cache
export {
  computeFileHash,
  computeSourceHashes,
  writeCacheManifest,
  writeConceptManifest,
  writeCompiledSyncs,
  writeRegistrations,
  readCacheManifest,
  readConceptManifests,
  readAllCompiledSyncs,
  readRegistrations,
  validateCache,
  getCacheDir,
} from './cache.js';
export type {
  CacheManifest,
  RegistrationEntry,
} from './cache.js';

// --- Concept implementation re-exports ---
// These are NOT kernel code — they are concept implementations
// re-exported for convenience so consumers can import from @copf/kernel.

// SyncEngine concept (matching algorithm, action log)
export {
  SyncEngine,
  ActionLog,
  buildSyncIndex,
  matchWhenClause,
  evaluateWhere,
  buildInvocations,
  indexKey,
  createSyncEngineHandler,
  DistributedSyncEngine,
} from '../../implementations/typescript/framework/sync-engine.impl.js';
export type {
  SyncIndex,
  PendingSyncEntry,
  AvailabilityListener,
} from '../../implementations/typescript/framework/sync-engine.impl.js';

// Parsers (concept implementations)
export { parseConceptFile } from '../../implementations/typescript/framework/spec-parser.impl.js';
export { parseSyncFile } from '../../implementations/typescript/framework/sync-parser.impl.js';

// Schema and code generation
export { schemaGenHandler } from '../../implementations/typescript/framework/schema-gen.impl.js';

// Flow tracing
export { buildFlowTrace, renderFlowTrace } from '../../implementations/typescript/framework/flow-trace.impl.js';
export type { FlowTrace, TraceNode, TraceSyncNode } from '../../implementations/typescript/framework/flow-trace.impl.js';

// Deployment validator
export {
  parseDeploymentManifest,
  validateDeploymentManifest,
} from '../../implementations/typescript/framework/deployment-validator.impl.js';
export type {
  DeploymentManifest,
  RuntimeConfig,
  ConceptDeployment,
  ConceptImplementation,
  SyncDeployment,
  ValidationResult,
  DeploymentPlan,
  ConceptPlacement,
  SyncAssignment,
} from '../../implementations/typescript/framework/deployment-validator.impl.js';

// Lite query adapter
export {
  LiteQueryAdapter,
  createStorageLiteProtocol,
} from '../../implementations/typescript/framework/lite-query-adapter.js';

// Migration
export {
  checkMigrationNeeded,
  createMigrationGatedTransport,
  getStoredVersion,
  setStoredVersion,
} from '../../implementations/typescript/framework/migration.impl.js';

// Mock handler
export { createMockHandler } from '../../implementations/typescript/framework/mock-handler.js';

// --- Shared types ---
export type {
  ConceptHandler,
  ConceptStorage,
  ConceptTransport,
  ConceptRegistry,
  ConceptQuery,
  ActionInvocation,
  ActionCompletion,
  ActionRecord,
  CompiledSync,
  WhenPattern,
  FieldPattern,
  WhereEntry,
  ThenAction,
  ThenField,
  Binding,
  ConceptAST,
  TypeExpr,
  StateEntry,
  ActionDecl,
  ParamDecl,
  ReturnVariant,
  InvariantDecl,
  ActionPattern,
  ArgPattern,
  ConceptManifest,
  TypeParamInfo,
  RelationSchema,
  FieldSchema,
  ResolvedType,
  ActionSchema,
  ActionParamSchema,
  VariantSchema,
  InvariantSchema,
  InvariantStep,
  InvariantValue,
  EntryMeta,
  ConflictResolution,
  ConflictInfo,
  LiteQueryProtocol,
  LiteFilter,
  ConceptStateSnapshot,
} from './types.js';

export { generateId, timestamp } from './types.js';

// --- Convenience factory ---
// Creates a kernel with the SyncEngine concept handler pre-wired.
// Includes backwards-compatible convenience methods (loadSyncs,
// parseConcept, getFlowTrace, registerVersionedConcept, etc.)

import { readFileSync } from 'fs';
import { createConceptRegistry } from './transport.js';
import { createInProcessAdapter } from './transport.js';
import { createInMemoryStorage } from './storage.js';
import { createSelfHostedKernel } from './self-hosted.js';
import type { Kernel } from './self-hosted.js';
import {
  createSyncEngineHandler,
  SyncEngine,
  ActionLog,
} from '../../implementations/typescript/framework/sync-engine.impl.js';
import { parseConceptFile } from '../../implementations/typescript/framework/spec-parser.impl.js';
import { parseSyncFile } from '../../implementations/typescript/framework/sync-parser.impl.js';
import { buildFlowTrace } from '../../implementations/typescript/framework/flow-trace.impl.js';
import type { FlowTrace } from '../../implementations/typescript/framework/flow-trace.impl.js';
import {
  checkMigrationNeeded,
  createMigrationGatedTransport,
} from '../../implementations/typescript/framework/migration.impl.js';
import type {
  ConceptHandler,
  CompiledSync,
  ActionRecord,
} from './types.js';

export interface MigrationStatus {
  uri: string;
  currentVersion: number;
  requiredVersion: number;
  migrationRequired: boolean;
}

export interface FullKernel extends Kernel {
  loadSyncs(path: string): Promise<void>;
  parseConcept(path: string): ReturnType<typeof parseConceptFile>;
  getFlowTrace(flowId: string): FlowTrace | null;
  registerVersionedConcept(
    uri: string,
    handler: ConceptHandler,
    specVersion?: number,
  ): Promise<MigrationStatus | null>;
  getMigrationStatus(): MigrationStatus[];
}

export function createKernel(): FullKernel {
  const registry = createConceptRegistry();
  const { handler, engine, log } = createSyncEngineHandler(registry);
  const base = createSelfHostedKernel(handler, log, registry);

  const migrationStatuses = new Map<string, MigrationStatus>();

  return {
    ...base,

    async loadSyncs(path: string): Promise<void> {
      const source = readFileSync(path, 'utf-8');
      const syncs = parseSyncFile(source);
      for (const sync of syncs) {
        base.registerSync(sync);
      }
    },

    parseConcept(path: string) {
      const source = readFileSync(path, 'utf-8');
      return parseConceptFile(source);
    },

    getFlowTrace(flowId: string): FlowTrace | null {
      return buildFlowTrace(
        flowId,
        log,
        engine.getSyncIndex(),
        engine.getRegisteredSyncs(),
      );
    },

    async registerVersionedConcept(
      uri: string,
      conceptHandler: ConceptHandler,
      specVersion?: number,
    ): Promise<MigrationStatus | null> {
      const storage = createInMemoryStorage();
      const baseTransport = createInProcessAdapter(conceptHandler, storage);

      const needed = await checkMigrationNeeded(specVersion, storage);

      if (needed) {
        const gated = createMigrationGatedTransport(
          baseTransport,
          storage,
          needed.currentVersion,
          needed.requiredVersion,
        );
        registry.register(uri, gated);

        const status: MigrationStatus = {
          uri,
          currentVersion: needed.currentVersion,
          requiredVersion: needed.requiredVersion,
          migrationRequired: true,
        };
        migrationStatuses.set(uri, status);
        return status;
      }

      registry.register(uri, baseTransport);
      if (specVersion !== undefined) {
        migrationStatuses.set(uri, {
          uri,
          currentVersion: specVersion,
          requiredVersion: specVersion,
          migrationRequired: false,
        });
      }
      return null;
    },

    getMigrationStatus(): MigrationStatus[] {
      return [...migrationStatuses.values()];
    },
  };
}
