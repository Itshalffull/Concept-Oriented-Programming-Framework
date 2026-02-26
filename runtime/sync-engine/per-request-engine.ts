// ============================================================
// Per-Request Engine Bootstrap
//
// Boots the sync engine inside the same Lambda/GCF function as
// the concept handler. The engine runs per-request:
//   1. Loads compiled syncs from bundled .clef-cache/ artifacts
//   2. Builds sync index (fast Map construction, no parsing)
//   3. Recovers flow state from durable action log
//   4. Evaluates sync matching for the incoming completion
//   5. Persists new action log entries and sync edges
//
// The sync index and compiled syncs are cached at module level
// across warm invocations. Only the flow state is loaded per-request.
// ============================================================

import type {
  ActionCompletion,
  ActionInvocation,
  CompiledSync,
  ConceptRegistry,
} from '../types.js';
import {
  SyncEngine,
  ActionLog,
  buildSyncIndex,
} from '../../handlers/ts/framework/engine.js';
import type { SyncIndex } from '../../handlers/ts/framework/engine.js';
import type { DurableActionLog } from '../action-log/durable-action-log.js';
import type { DistributedFiringGuard } from '../adapters/serverless/distributed-lock.js';

// --- Module-Level Cache ---
// These survive across warm invocations in the same execution context.

let cachedSyncs: CompiledSync[] | null = null;
let cachedSyncIndex: SyncIndex | null = null;

// --- Configuration ---

export interface PerRequestEngineConfig {
  /** Compiled syncs (bundled in the deployment package) */
  compiledSyncs: CompiledSync[];
  /** Concept registry for where-clause query evaluation */
  registry: ConceptRegistry;
  /** Durable action log for persistence and recovery */
  durableLog: DurableActionLog;
  /** Distributed firing guard for cross-instance deduplication */
  firingGuard?: DistributedFiringGuard;
}

// --- Per-Request Engine ---

/**
 * Create a per-request engine that evaluates syncs within
 * a single Lambda/GCF invocation.
 *
 * Module-level caching ensures the sync index is built only once
 * per execution context. Flow state is loaded from the durable
 * action log on each request.
 */
export function createPerRequestEngine(config: PerRequestEngineConfig) {
  // Cache compiled syncs and index at module level
  if (!cachedSyncs || !cachedSyncIndex) {
    cachedSyncs = config.compiledSyncs;
    cachedSyncIndex = buildSyncIndex(config.compiledSyncs);
  }

  return {
    /**
     * Process a completion: match syncs, build invocations, persist state.
     *
     * @param completion - The completion to process
     * @returns Invocations to dispatch to target concepts
     */
    async onCompletion(completion: ActionCompletion): Promise<ActionInvocation[]> {
      // 1. Build a local engine instance with in-memory action log
      const localLog = new ActionLog();
      const engine = new SyncEngine(localLog, config.registry);

      // 2. Register cached syncs
      for (const sync of cachedSyncs!) {
        engine.registerSync(sync);
      }

      // 3. Load existing flow state from durable log
      const flowRecords = await config.durableLog.loadFlow(completion.flow);
      for (const record of flowRecords) {
        if (record.type === 'completion') {
          localLog.append({
            id: record.id,
            concept: record.concept,
            action: record.action,
            input: record.input,
            variant: record.variant || '',
            output: record.output || {},
            flow: record.flow,
            timestamp: record.timestamp,
          }, record.parent);
        } else {
          localLog.appendInvocation({
            id: record.id,
            concept: record.concept,
            action: record.action,
            input: record.input,
            flow: record.flow,
            sync: record.sync,
            timestamp: record.timestamp,
          }, record.parent);
        }
      }

      // 4. Rebuild sync edges from durable log
      // (The in-memory log doesn't have the edges yet)
      // We rely on the distributed firing guard for dedup

      // 5. Run the engine's onCompletion
      const invocations = await engine.onCompletion(completion);

      // 6. Persist the new completion to durable log
      await config.durableLog.append({
        id: completion.id,
        type: 'completion',
        concept: completion.concept,
        action: completion.action,
        input: completion.input,
        variant: completion.variant,
        output: completion.output,
        flow: completion.flow,
        timestamp: completion.timestamp,
      });

      // 7. Filter through distributed firing guard if available
      const guardedInvocations: ActionInvocation[] = [];

      for (const invocation of invocations) {
        if (config.firingGuard) {
          // Use the completion IDs from the match as the guard key
          const acquired = await config.firingGuard.tryAcquire(
            [completion.id],
            `${invocation.sync || 'unknown'}:${invocation.id}`,
          );
          if (!acquired) continue;
        }

        // Persist the invocation to durable log
        await config.durableLog.append({
          id: invocation.id,
          type: 'invocation',
          concept: invocation.concept,
          action: invocation.action,
          input: invocation.input,
          flow: invocation.flow,
          sync: invocation.sync,
          timestamp: invocation.timestamp,
        });

        // Record sync edge in durable log
        await config.durableLog.addSyncEdge(
          completion.id,
          invocation.id,
          invocation.sync || 'unknown',
        );

        guardedInvocations.push(invocation);
      }

      return guardedInvocations;
    },

    /**
     * Get the cached sync index (for diagnostics).
     */
    getSyncIndex(): SyncIndex {
      return cachedSyncIndex!;
    },

    /**
     * Get the cached compiled syncs (for diagnostics).
     */
    getCompiledSyncs(): CompiledSync[] {
      return cachedSyncs || [];
    },
  };
}

/**
 * Invalidate the module-level sync cache.
 * Used when hot-reloading syncs or in tests.
 */
export function invalidatePerRequestCache(): void {
  cachedSyncs = null;
  cachedSyncIndex = null;
}
