// ============================================================
// COPF Kernel - In-Process Transport Adapter & Concept Registry
// ============================================================

import type {
  ConceptTransport,
  ConceptQuery,
  ConceptHandler,
  ConceptStorage,
  ActionInvocation,
  ActionCompletion,
  ConceptRegistry,
} from './types.js';
import { timestamp } from './types.js';

/**
 * In-process transport adapter. Wraps a concept handler
 * and its storage into a ConceptTransport that dispatches
 * action invocations directly as function calls.
 */
export function createInProcessAdapter(
  handler: ConceptHandler,
  storage: ConceptStorage,
): ConceptTransport {
  return {
    queryMode: 'lite',

    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      const actionFn = handler[invocation.action];
      if (!actionFn) {
        return {
          id: invocation.id,
          concept: invocation.concept,
          action: invocation.action,
          input: invocation.input,
          variant: 'error',
          output: { message: `Unknown action: ${invocation.action}` },
          flow: invocation.flow,
          timestamp: timestamp(),
        };
      }

      const result = await actionFn(invocation.input, storage);
      const { variant, ...output } = result;

      return {
        id: invocation.id,
        concept: invocation.concept,
        action: invocation.action,
        input: invocation.input,
        variant,
        output,
        flow: invocation.flow,
        timestamp: timestamp(),
      };
    },

    async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
      if (request.args && Object.keys(request.args).length > 0) {
        return storage.find(request.relation, request.args);
      }
      return storage.find(request.relation);
    },

    async health() {
      return { available: true, latency: 0 };
    },
  };
}

/**
 * Create a concept registry that maps URIs to transport adapters.
 * Supports Phase 11 hot reloading: reloadConcept and deregisterConcept.
 */
export function createConceptRegistry(): ConceptRegistry {
  const transports = new Map<string, ConceptTransport>();

  return {
    register(uri: string, transport: ConceptTransport): void {
      transports.set(uri, transport);
    },

    resolve(uri: string): ConceptTransport | undefined {
      return transports.get(uri);
    },

    available(uri: string): boolean {
      return transports.has(uri);
    },

    /**
     * Update the transport for an existing concept (Phase 11).
     * In-flight invocations to the old transport drain naturally.
     * New invocations route to the new transport.
     * See Architecture doc Section 16.3, Scenario B.
     */
    reloadConcept(uri: string, transport: ConceptTransport): void {
      transports.set(uri, transport);
    },

    /**
     * Remove a concept from the registry (Phase 11).
     * Callers should mark dependent syncs as degraded via
     * SyncEngine.degradeSyncsForConcept().
     * See Architecture doc Section 16.3, Scenario C.
     */
    deregisterConcept(uri: string): boolean {
      return transports.delete(uri);
    },
  };
}
