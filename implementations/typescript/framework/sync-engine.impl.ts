// ============================================================
// Stage 3 — SyncEngine Concept Implementation
//
// From Section 10.1:
// "The SyncEngine concept processes completions and emits
//  invocations, while the kernel merely dispatches between
//  it and the other concepts."
//
// This concept wraps the kernel's SyncEngine and ActionLog,
// exposing them as concept actions. The self-hosted kernel
// delegates sync evaluation to this concept.
//
// Actions per the spec in Section 10.1:
//   registerSync(sync: CompiledSync) -> ok()
//   onCompletion(completion: ActionCompletion)
//     -> ok(invocations: list ActionInvocation)
//   evaluateWhere(bindings, queries) -> ok(results) | error(message)
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  CompiledSync,
  ActionCompletion,
  ActionInvocation,
  ConceptRegistry,
  Binding,
} from '../../../kernel/src/types.js';
import {
  SyncEngine,
  ActionLog,
  matchWhenClause,
  evaluateWhere,
  buildInvocations,
} from '../../../kernel/src/engine.js';
import { generateId, timestamp } from '../../../kernel/src/types.js';

/**
 * Create a SyncEngine concept handler.
 *
 * Unlike other concept handlers, this one needs a reference to the
 * ConceptRegistry because the engine needs to query concept state
 * when evaluating where-clauses. This is the "pre-conceptual"
 * dependency described in Section 10.3.
 */
export function createSyncEngineHandler(registry: ConceptRegistry): {
  handler: ConceptHandler;
  engine: SyncEngine;
  log: ActionLog;
} {
  const log = new ActionLog();
  const engine = new SyncEngine(log, registry);

  const handler: ConceptHandler = {
    /**
     * Register a compiled synchronization for evaluation.
     * The sync is indexed by (concept, action) pairs in its
     * when clause for O(1) lookup on completion arrival.
     */
    async registerSync(input, _storage) {
      const sync = input.sync as CompiledSync;

      if (!sync || !sync.name) {
        return { variant: 'error', message: 'Invalid sync: missing name' };
      }

      engine.registerSync(sync);

      return { variant: 'ok' };
    },

    /**
     * Core evaluation loop from Section 6.2:
     * 1. Append completion to the action log
     * 2. Find candidate syncs via index
     * 3. Match when-clause patterns
     * 4. Check firing guard (provenance edges)
     * 5. Evaluate where-clauses
     * 6. Build and return invocations
     */
    async onCompletion(input, _storage) {
      const completion = input.completion as ActionCompletion;
      const parentId = input.parentId as string | undefined;

      if (!completion || !completion.id) {
        return { variant: 'ok', invocations: [] };
      }

      const invocations = await engine.onCompletion(completion, parentId);

      return { variant: 'ok', invocations };
    },

    /**
     * Evaluate a where clause against concept state.
     * This is separated as its own action so it can be
     * tested and observed independently.
     */
    async evaluateWhere(input, _storage) {
      const bindings = input.bindings as Binding;
      const queries = input.queries as CompiledSync['where'];

      if (!bindings || !queries) {
        return { variant: 'error', message: 'Missing bindings or queries' };
      }

      try {
        const results = await evaluateWhere(queries, bindings, registry);
        return { variant: 'ok', results };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { variant: 'error', message };
      }
    },
  };

  return { handler, engine, log };
}
