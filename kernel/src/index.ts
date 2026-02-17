// ============================================================
// COPF Kernel - Entry Point
// createKernel: the Stage 0 minimal runtime
// ============================================================

import { readFileSync } from 'fs';
import type {
  ConceptHandler,
  CompiledSync,
  ActionCompletion,
  ActionInvocation,
  ActionRecord,
  ConceptRegistry,
  ConceptQuery,
} from './types.js';
import { generateId, timestamp } from './types.js';
import { createInMemoryStorage } from './storage.js';
import { createInProcessAdapter, createConceptRegistry } from './transport.js';
import { SyncEngine, ActionLog } from './engine.js';
import { parseConceptFile } from './parser.js';
import { parseSyncFile } from './sync-parser.js';
import { buildFlowTrace } from './flow-trace.js';
import type { FlowTrace } from './flow-trace.js';
import {
  checkMigrationNeeded,
  createMigrationGatedTransport,
  getStoredVersion,
  setStoredVersion,
} from './migration.js';

// Re-export everything for consumers
export { createInMemoryStorage } from './storage.js';
export { createInProcessAdapter, createConceptRegistry } from './transport.js';
export { SyncEngine, ActionLog, buildSyncIndex } from './engine.js';
export { parseConceptFile } from './parser.js';
export { parseSyncFile } from './sync-parser.js';
export { createSelfHostedKernel } from './self-hosted.js';
// Stage 5: HTTP transport adapters
export {
  createHttpLiteAdapter,
  createHttpGraphQLAdapter,
  createHttpConceptServer,
} from './http-transport.js';
export type {
  LiteFilter,
  ConceptStateSnapshot,
  HttpFetchFn,
} from './http-transport.js';
// Stage 5: Deployment manifest
export {
  parseDeploymentManifest,
  validateDeploymentManifest,
} from './deploy.js';
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
} from './deploy.js';
// Phase 9: Lite query protocol + adapter
export {
  LiteQueryAdapter,
  createStorageLiteProtocol,
} from './lite-query.js';
export type {
  LiteQueryProtocol,
  LiteFilter as LiteQueryFilter,
  ConceptStateSnapshot as LiteStateSnapshot,
} from './lite-query.js';
// Phase 9: Eventual sync queue + distributed engine
export { DistributedSyncEngine } from './eventual-queue.js';
export type {
  PendingSyncEntry,
  AvailabilityListener,
} from './eventual-queue.js';
// Phase 9: WebSocket transport
export {
  createWebSocketAdapter,
  createWebSocketConceptServer,
} from './ws-transport.js';
export type {
  WsMessage,
  MockWebSocket,
  WebSocketFactory,
} from './ws-transport.js';
// Phase 10: Flow Tracing
export { buildFlowTrace, renderFlowTrace } from './flow-trace.js';
export type { FlowTrace, TraceNode, TraceSyncNode } from './flow-trace.js';
// Phase 12: Schema Migration
export {
  checkMigrationNeeded,
  createMigrationGatedTransport,
  getStoredVersion,
  setStoredVersion,
} from './migration.js';
// Phase 10: Test Helpers
export { createMockHandler } from './test-helpers.js';
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
  // Stage 4: ConceptManifest types
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
} from './types.js';

// --- Web Bootstrap Concept ---

const WEB_CONCEPT_URI = 'urn:copf/Web';

interface WebRequest {
  method: string;
  [key: string]: unknown;
}

interface WebResponse {
  body?: Record<string, unknown>;
  error?: string;
  code?: number;
  flowId: string;
}

/**
 * The Kernel is the Stage 0 minimal runtime.
 * It boots the sync engine, registers concepts, and processes flows.
 */
export interface MigrationStatus {
  uri: string;
  currentVersion: number;
  requiredVersion: number;
  migrationRequired: boolean;
}

export interface Kernel {
  /** Register a concept handler with in-memory storage */
  registerConcept(uri: string, handler: ConceptHandler): void;

  /**
   * Register a versioned concept. Checks storage for schema version
   * and gates the concept if migration is required.
   * Returns migration status (null if unversioned or version matches).
   */
  registerVersionedConcept(
    uri: string,
    handler: ConceptHandler,
    specVersion?: number,
  ): Promise<MigrationStatus | null>;

  /** Get migration status for all registered concepts */
  getMigrationStatus(): MigrationStatus[];

  /** Register a compiled sync definition */
  registerSync(sync: CompiledSync): void;

  /** Parse and load syncs from a .sync file */
  loadSyncs(path: string): Promise<void>;

  /** Parse a .concept file and return the AST */
  parseConcept(path: string): ReturnType<typeof parseConceptFile>;

  /** Simulate an incoming web request and process the entire flow */
  handleRequest(request: WebRequest): Promise<WebResponse>;

  /** Get the action log for a specific flow */
  getFlowLog(flowId: string): ActionRecord[];

  /** Get a structured FlowTrace for a specific flow (Phase 10) */
  getFlowTrace(flowId: string): FlowTrace | null;

  /** Directly invoke a concept action */
  invokeConcept(
    uri: string,
    action: string,
    input: Record<string, unknown>,
  ): Promise<{ variant: string; [key: string]: unknown }>;

  /** Query a concept's state */
  queryConcept(
    uri: string,
    relation: string,
    args?: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]>;
}

export function createKernel(): Kernel {
  const registry = createConceptRegistry();
  const log = new ActionLog();
  const engine = new SyncEngine(log, registry);

  // Track pending responses for flows
  const pendingResponses = new Map<string, WebResponse>();

  // Register the Web bootstrap concept
  const webHandler: ConceptHandler = {
    async respond(input) {
      // The respond action stores the response for the flow
      const requestId = input.request as string;
      const body = input.body as Record<string, unknown> | undefined;
      const error = input.error as string | undefined;
      const code = input.code as number | undefined;

      // Store response indexed by request ID
      pendingResponses.set(requestId, {
        body: body || {},
        error,
        code,
        flowId: '',  // will be set later
      });

      return { variant: 'ok' };
    },
  };

  const webStorage = createInMemoryStorage();
  registry.register(WEB_CONCEPT_URI, createInProcessAdapter(webHandler, webStorage));

  // Track migration status per concept
  const migrationStatuses = new Map<string, MigrationStatus>();

  return {
    registerConcept(uri: string, handler: ConceptHandler): void {
      const storage = createInMemoryStorage();
      const transport = createInProcessAdapter(handler, storage);
      registry.register(uri, transport);
    },

    async registerVersionedConcept(
      uri: string,
      handler: ConceptHandler,
      specVersion?: number,
    ): Promise<MigrationStatus | null> {
      const storage = createInMemoryStorage();
      const baseTransport = createInProcessAdapter(handler, storage);

      const needed = await checkMigrationNeeded(specVersion, storage);

      if (needed) {
        // Wrap with migration gate
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

      // No migration needed — register normally
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

    registerSync(sync: CompiledSync): void {
      engine.registerSync(sync);
    },

    async loadSyncs(path: string): Promise<void> {
      const source = readFileSync(path, 'utf-8');
      const syncs = parseSyncFile(source);
      for (const sync of syncs) {
        engine.registerSync(sync);
      }
    },

    parseConcept(path: string) {
      const source = readFileSync(path, 'utf-8');
      return parseConceptFile(source);
    },

    async handleRequest(request: WebRequest): Promise<WebResponse> {
      const flowId = generateId();
      const requestId = generateId();

      // Create the initial Web/request completion (origin action)
      const requestCompletion: ActionCompletion = {
        id: generateId(),
        concept: WEB_CONCEPT_URI,
        action: 'request',
        input: request,
        variant: 'ok',
        output: { request: requestId, ...request },
        flow: flowId,
        timestamp: timestamp(),
      };

      // Process the flow: feed the completion to the engine, then
      // recursively process any produced invocations
      await processFlow(requestCompletion, engine, registry, flowId);

      // Look for the Web/respond completion in the flow
      const response = pendingResponses.get(requestId);
      if (response) {
        pendingResponses.delete(requestId);
        response.flowId = flowId;
        return response;
      }

      // No response produced — return a default
      return { flowId, body: {} };
    },

    getFlowLog(flowId: string): ActionRecord[] {
      return log.getFlowRecords(flowId);
    },

    getFlowTrace(flowId: string): FlowTrace | null {
      return buildFlowTrace(
        flowId,
        log,
        engine.getSyncIndex(),
        engine.getRegisteredSyncs(),
      );
    },

    async invokeConcept(
      uri: string,
      action: string,
      input: Record<string, unknown>,
    ): Promise<{ variant: string; [key: string]: unknown }> {
      const transport = registry.resolve(uri);
      if (!transport) {
        throw new Error(`Concept not found: ${uri}`);
      }

      const invocation: ActionInvocation = {
        id: generateId(),
        concept: uri,
        action,
        input,
        flow: generateId(),
        timestamp: timestamp(),
      };

      const completion = await transport.invoke(invocation);
      return { variant: completion.variant, ...completion.output };
    },

    async queryConcept(
      uri: string,
      relation: string,
      args?: Record<string, unknown>,
    ): Promise<Record<string, unknown>[]> {
      const transport = registry.resolve(uri);
      if (!transport) {
        throw new Error(`Concept not found: ${uri}`);
      }

      return transport.query({ relation, args });
    },
  };
}

/**
 * Process a flow to completion by recursively evaluating
 * completions through the sync engine and dispatching invocations.
 */
async function processFlow(
  initialCompletion: ActionCompletion,
  engine: SyncEngine,
  registry: ConceptRegistry,
  flowId: string,
): Promise<void> {
  // Queue of completions to process
  const queue: { completion: ActionCompletion; parentId?: string }[] = [
    { completion: initialCompletion },
  ];

  // Safety: limit iterations to prevent infinite loops
  const MAX_ITERATIONS = 1000;
  let iterations = 0;

  while (queue.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;

    const { completion, parentId } = queue.shift()!;

    // Feed the completion to the sync engine
    const invocations = await engine.onCompletion(completion, parentId);

    // Dispatch each invocation to the appropriate concept
    for (const invocation of invocations) {
      const transport = registry.resolve(invocation.concept);
      if (!transport) {
        console.warn(`Concept not found: ${invocation.concept}, skipping invocation`);
        continue;
      }

      // Execute the invocation
      const result = await transport.invoke(invocation);

      // Queue the resulting completion for further processing
      queue.push({ completion: result, parentId: invocation.id });
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    console.warn(`Flow ${flowId} exceeded maximum iterations (${MAX_ITERATIONS})`);
  }
}
