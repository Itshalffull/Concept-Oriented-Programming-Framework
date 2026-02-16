// ============================================================
// COPF Kernel - Self-Hosted Runtime (Stage 3)
//
// From Section 10.1:
// "The SyncEngine concept is itself run by the kernel engine.
//  This is the key bootstrapping moment: the SyncEngine concept
//  processes completions and emits invocations, while the kernel
//  merely dispatches between it and the other concepts."
//
// From Section 10.3 — What stays in the kernel forever:
// - Process entry point
// - Message dispatch (routing completions to SyncEngine and
//   routing its output invocations to target concepts)
// - Transport adapter instantiation
//
// This module provides createSelfHostedKernel(), which has the
// same Kernel interface as createKernel() but delegates sync
// evaluation to the SyncEngine concept instead of using the
// kernel's built-in SyncEngine class directly.
// ============================================================

import { readFileSync } from 'fs';
import type {
  ConceptHandler,
  ConceptStorage,
  CompiledSync,
  ActionCompletion,
  ActionInvocation,
  ActionRecord,
  ConceptRegistry,
} from './types.js';
import { generateId, timestamp } from './types.js';
import { createInMemoryStorage } from './storage.js';
import { createInProcessAdapter, createConceptRegistry } from './transport.js';
import { ActionLog } from './engine.js';
import { parseConceptFile } from './parser.js';
import { parseSyncFile } from './sync-parser.js';
import type { Kernel } from './index.js';

const WEB_CONCEPT_URI = 'urn:copf/Web';
const SYNC_ENGINE_URI = 'urn:copf/SyncEngine';

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
 * Create a self-hosted kernel where sync evaluation is performed
 * by the SyncEngine concept rather than the kernel's built-in engine.
 *
 * The caller must provide a SyncEngine concept handler (created via
 * createSyncEngineHandler) and the ConceptRegistry shared between
 * the kernel and the SyncEngine. This is the "pre-conceptual"
 * dependency from Section 10.3 — the registry cannot itself be a
 * concept without infinite regress.
 *
 * Flow processing works as follows:
 * 1. External stimulus creates an initial completion
 * 2. Kernel routes completion to SyncEngine/onCompletion
 * 3. SyncEngine returns invocations
 * 4. Kernel dispatches each invocation to the target concept
 * 5. Each resulting completion goes back to step 2
 * 6. Flow completes when no more invocations are produced
 */
export function createSelfHostedKernel(
  syncEngineHandler: ConceptHandler,
  actionLog: ActionLog,
  registry: ConceptRegistry,
): Kernel {

  // Track pending responses for flows
  const pendingResponses = new Map<string, WebResponse>();

  // Register the Web bootstrap concept (same as Stage 0)
  const webHandler: ConceptHandler = {
    async respond(input) {
      const requestId = input.request as string;
      const body = input.body as Record<string, unknown> | undefined;
      const error = input.error as string | undefined;
      const code = input.code as number | undefined;

      pendingResponses.set(requestId, {
        body: body || {},
        error,
        code,
        flowId: '',
      });

      return { variant: 'ok' };
    },
  };

  const webStorage = createInMemoryStorage();
  registry.register(WEB_CONCEPT_URI, createInProcessAdapter(webHandler, webStorage));

  // Register the SyncEngine concept itself
  const syncEngineStorage = createInMemoryStorage();
  registry.register(SYNC_ENGINE_URI, createInProcessAdapter(syncEngineHandler, syncEngineStorage));

  return {
    registerConcept(uri: string, handler: ConceptHandler): void {
      const storage = createInMemoryStorage();
      const transport = createInProcessAdapter(handler, storage);
      registry.register(uri, transport);
    },

    registerSync(sync: CompiledSync): void {
      // Delegate to the SyncEngine concept — this is the key difference
      // from Stage 0. Instead of calling engine.registerSync() directly,
      // we invoke the SyncEngine concept's registerSync action.
      //
      // We call the handler directly here (not through transport) because
      // sync registration happens during bootstrap, before the flow
      // processing loop starts. This is part of "process startup" from
      // Section 10.3.
      syncEngineHandler.registerSync(
        { sync },
        syncEngineStorage,
      );
    },

    async loadSyncs(path: string): Promise<void> {
      const source = readFileSync(path, 'utf-8');
      const syncs = parseSyncFile(source);
      for (const sync of syncs) {
        this.registerSync(sync);
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

      // Process the flow using the SyncEngine concept
      await processFlowViaEngine(
        requestCompletion,
        syncEngineHandler,
        syncEngineStorage,
        registry,
        flowId,
      );

      // Look for the Web/respond completion in the flow
      const response = pendingResponses.get(requestId);
      if (response) {
        pendingResponses.delete(requestId);
        response.flowId = flowId;
        return response;
      }

      return { flowId, body: {} };
    },

    getFlowLog(flowId: string): ActionRecord[] {
      return actionLog.getFlowRecords(flowId);
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
 * Process a flow to completion by routing completions through
 * the SyncEngine concept.
 *
 * This is the "message dispatch" from Section 10.3 — the minimal
 * routing logic that cannot itself be a concept without infinite
 * regress. It:
 * 1. Feeds each completion to SyncEngine/onCompletion
 * 2. Receives the produced invocations
 * 3. Dispatches each invocation to the target concept
 * 4. Queues the resulting completion for step 1
 */
async function processFlowViaEngine(
  initialCompletion: ActionCompletion,
  syncEngineHandler: ConceptHandler,
  syncEngineStorage: ConceptStorage,
  registry: ConceptRegistry,
  flowId: string,
): Promise<void> {
  const queue: { completion: ActionCompletion; parentId?: string }[] = [
    { completion: initialCompletion },
  ];

  const MAX_ITERATIONS = 1000;
  let iterations = 0;

  while (queue.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;

    const { completion, parentId } = queue.shift()!;

    // Route completion to SyncEngine concept
    const result = await syncEngineHandler.onCompletion(
      { completion, parentId },
      syncEngineStorage,
    );

    if (result.variant !== 'ok') continue;

    const invocations = (result.invocations || []) as ActionInvocation[];

    // Dispatch each invocation to the target concept
    for (const invocation of invocations) {
      // Skip invocations to the SyncEngine itself to avoid
      // infinite recursion — the engine doesn't evaluate its
      // own completions
      if (invocation.concept === SYNC_ENGINE_URI) continue;

      const transport = registry.resolve(invocation.concept);
      if (!transport) {
        continue;
      }

      const completionResult = await transport.invoke(invocation);

      // Queue the resulting completion for further processing
      queue.push({ completion: completionResult, parentId: invocation.id });
    }
  }
}

