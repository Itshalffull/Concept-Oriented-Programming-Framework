// ============================================================
// Clef Kernel - In-Process Transport Adapter & Concept Registry
// ============================================================

import type {
  ConceptTransport,
  ConceptQuery,
  ConceptHandler,
  ConceptStorage,
  ActionInvocation,
  ActionCompletion,
  ConceptRegistry,
} from '../types.js';
import { timestamp } from '../types.js';
import type { FunctionalConceptHandler } from '../functional-handler.js';
import type { StorageProgram } from '../storage-program.js';
import { interpret } from '../interpreter.js';

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

      const rawResult = await actionFn(invocation.input, storage);

      // Auto-detect functional handlers: if result has instructions array,
      // it's a StorageProgram that needs interpretation
      let result: { variant: string; [key: string]: unknown };
      if (rawResult && Array.isArray((rawResult as StorageProgram<unknown>).instructions)) {
        const execResult = await interpret(rawResult as StorageProgram<unknown>, storage);
        result = { variant: execResult.variant, ...execResult.output };
      } else {
        result = rawResult as { variant: string; [key: string]: unknown };
      }
      const { variant, ...rest } = result;

      // Include variant in output so sync output patterns like
      // => [variant: "ok"] can match against it.
      return {
        id: invocation.id,
        concept: invocation.concept,
        action: invocation.action,
        input: invocation.input,
        variant,
        output: { ...rest, variant },
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
 * Wrap a FunctionalConceptHandler into a ConceptHandler by interpreting
 * each action's returned StorageProgram against the provided storage.
 * This allows functional handlers to be used anywhere a ConceptHandler
 * is expected (kernel registration, transport adapters, tests, etc.).
 */
export function wrapFunctionalHandler(
  handler: FunctionalConceptHandler,
  storage: ConceptStorage,
): ConceptHandler {
  const wrapped: ConceptHandler = {};
  // Dynamically wrap each action so that any action name works
  return new Proxy(wrapped, {
    get(_target, prop: string) {
      if (typeof handler[prop] !== 'function') return undefined;
      return async (input: Record<string, unknown>, _storage?: ConceptStorage) => {
        const program = handler[prop](input) as StorageProgram<unknown>;
        const result = await interpret(program, storage);
        return { variant: result.variant, ...result.output };
      };
    },
    has(_target, prop: string) {
      return typeof handler[prop] === 'function';
    },
  });
}

/**
 * In-process transport adapter for FunctionalConceptHandler.
 * Builds a StorageProgram for each action and interprets it
 * against the provided storage.
 */
export function createFunctionalInProcessAdapter(
  handler: FunctionalConceptHandler,
  storage: ConceptStorage,
): ConceptTransport {
  return createInProcessAdapter(wrapFunctionalHandler(handler, storage), storage);
}

/**
 * Create a concept registry that maps URIs to transport adapters.
 * Supports hot reloading via reloadConcept and deregisterConcept.
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
     * Update the transport for an existing concept (hot reload).
     * In-flight invocations to the old transport drain naturally.
     * New invocations route to the new transport.
     */
    reloadConcept(uri: string, transport: ConceptTransport): void {
      transports.set(uri, transport);
    },

    /**
     * Remove a concept from the registry.
     * Callers should mark dependent syncs as degraded via
     * SyncEngine.degradeSyncsForConcept().
     */
    deregisterConcept(uri: string): boolean {
      return transports.delete(uri);
    },
  };
}
