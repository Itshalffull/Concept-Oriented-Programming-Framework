// ============================================================
// SyncEngine Concept Implementation
//
// Wraps the kernel's SyncEngine and ActionLog as concept actions.
// Includes annotation-aware routing (eager/eventual/local) and
// the eventual sync queue with conflict production — formerly
// in a separate module, now unified here to share matching logic.
//
// Actions per the spec:
//   registerSync(sync) -> ok()
//   onCompletion(completion) -> ok(invocations)
//   evaluateWhere(bindings, queries) -> ok(results) | error(message)
//   queueSync(sync, bindings, flow) -> ok(pendingId)
//   onAvailabilityChange(conceptUri, available) -> ok(drained)
//   drainConflicts() -> ok(conflicts)
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  CompiledSync,
  ActionCompletion,
  ActionInvocation,
  ConceptRegistry,
  Binding,
  ConflictInfo,
} from '../../../kernel/src/types.js';
import {
  SyncEngine,
  ActionLog,
  matchWhenClause,
  evaluateWhere,
  buildInvocations,
  indexKey,
  buildSyncIndex,
} from './engine.js';
import type { SyncIndex } from './engine.js';
import { generateId, timestamp } from '../../../kernel/src/types.js';

// Re-export engine classes and functions so consumers can import
// them from the concept implementation rather than the kernel engine.
export {
  SyncEngine,
  ActionLog,
  buildSyncIndex,
  matchWhenClause,
  evaluateWhere,
  buildInvocations,
  indexKey,
};
export type { SyncIndex };

// --- Pending Sync Entry ---

export interface PendingSyncEntry {
  id: string;
  sync: CompiledSync;
  binding: Binding;
  flow: string;
  completionId: string;
  timestamp: string;
  retryCount: number;
}

// --- Availability Listener ---

export type AvailabilityListener = (
  conceptUri: string,
  available: boolean,
) => void;

// --- DistributedSyncEngine ---

/**
 * Extends the base SyncEngine with annotation-aware evaluation,
 * eventual sync queuing, and engine hierarchy coordination.
 *
 * This class unifies the core SyncEngine matching logic with the
 * eventual queue, eliminating the code duplication that existed
 * when these were separate modules. The evaluateSync() method
 * reuses matchWhenClause/evaluateWhere/buildInvocations directly.
 */
export class DistributedSyncEngine {
  private log: ActionLog;
  private registry: ConceptRegistry;
  private syncs: CompiledSync[] = [];
  private syncIndex = new Map<string, Set<CompiledSync>>();
  private pendingQueue: PendingSyncEntry[] = [];
  private availabilityListeners: AvailabilityListener[] = [];
  private runtimeId: string;
  private upstreamEngine: DistributedSyncEngine | null = null;
  private completionForwarders: ((completion: ActionCompletion) => Promise<void>)[] = [];
  private pendingConflicts: ActionCompletion[] = [];

  constructor(
    log: ActionLog,
    registry: ConceptRegistry,
    runtimeId: string = 'default',
  ) {
    this.log = log;
    this.registry = registry;
    this.runtimeId = runtimeId;
  }

  /** Set the upstream engine for hierarchy coordination */
  setUpstream(upstream: DistributedSyncEngine): void {
    this.upstreamEngine = upstream;
  }

  /** Add a completion forwarder (for upstream coordination) */
  addCompletionForwarder(forwarder: (completion: ActionCompletion) => Promise<void>): void {
    this.completionForwarders.push(forwarder);
  }

  /** Register a compiled sync */
  registerSync(sync: CompiledSync): void {
    this.syncs.push(sync);
    for (const pattern of sync.when) {
      const key = indexKey(pattern.concept, pattern.action);
      let set = this.syncIndex.get(key);
      if (!set) {
        set = new Set();
        this.syncIndex.set(key, set);
      }
      set.add(sync);
    }
  }

  /** Get the pending sync queue */
  getPendingQueue(): PendingSyncEntry[] {
    return [...this.pendingQueue];
  }

  /** Get the runtime ID */
  getRuntimeId(): string {
    return this.runtimeId;
  }

  /**
   * Process a completion with annotation-aware sync evaluation.
   *
   * For [eager] syncs: evaluate immediately, fail if concepts unavailable
   * For [eventual] syncs: queue if concepts unavailable, retry later
   * For [local] syncs: only evaluate if on same runtime
   */
  async onCompletion(
    completion: ActionCompletion,
    parentId?: string,
  ): Promise<ActionInvocation[]> {
    // 1. Append completion to the action log
    this.log.append(completion, parentId);

    // 2. Forward completion upstream if in a hierarchy
    for (const forwarder of this.completionForwarders) {
      await forwarder(completion);
    }

    // 3. Find candidate syncs
    const key = indexKey(completion.concept, completion.action);
    const candidates = this.syncIndex.get(key);
    if (!candidates) return [];

    const allInvocations: ActionInvocation[] = [];

    // 4. For each candidate sync, evaluate based on annotations
    for (const sync of candidates) {
      const annotations = sync.annotations || [];
      const isEventual = annotations.includes('eventual');
      const isLocal = annotations.includes('local');

      if (isLocal) {
        // Local syncs always execute on same runtime
        const invocations = await this.evaluateSync(sync, completion);
        allInvocations.push(...invocations);
        continue;
      }

      if (isEventual) {
        // Eventual syncs: try to evaluate; queue on failure
        const invocations = await this.evaluateSyncWithFallback(sync, completion);
        allInvocations.push(...invocations);
        continue;
      }

      // Default (eager): evaluate immediately
      const invocations = await this.evaluateSync(sync, completion);
      allInvocations.push(...invocations);
    }

    return allInvocations;
  }

  /**
   * Notify concept availability change.
   * Re-evaluates pending syncs that reference the concept.
   */
  async onAvailabilityChange(
    conceptUri: string,
    available: boolean,
  ): Promise<ActionInvocation[]> {
    for (const listener of this.availabilityListeners) {
      listener(conceptUri, available);
    }

    if (!available) return [];

    const toRetry: PendingSyncEntry[] = [];
    const remaining: PendingSyncEntry[] = [];

    for (const entry of this.pendingQueue) {
      const referencedConcepts = this.getReferencedConcepts(entry.sync);
      if (referencedConcepts.includes(conceptUri)) {
        toRetry.push(entry);
      } else {
        remaining.push(entry);
      }
    }

    this.pendingQueue = remaining;

    const allInvocations: ActionInvocation[] = [];

    for (const entry of toRetry) {
      const referenced = this.getReferencedConcepts(entry.sync);
      const allAvailable = referenced.every(uri => {
        const transport = this.registry.resolve(uri);
        return transport !== undefined;
      });

      if (allAvailable) {
        try {
          const whereBindings = await evaluateWhere(
            entry.sync.where,
            entry.binding,
            this.registry,
          );

          for (const fullBinding of whereBindings) {
            const invocations = buildInvocations(
              entry.sync.then,
              fullBinding,
              entry.flow,
              entry.sync.name,
            );

            for (const inv of invocations) {
              this.log.appendInvocation(inv, entry.completionId);
            }

            allInvocations.push(...invocations);
          }
        } catch {
          entry.retryCount++;
          this.pendingQueue.push(entry);
        }
      } else {
        this.pendingQueue.push(entry);
      }
    }

    return allInvocations;
  }

  /** Add an availability listener */
  onAvailability(listener: AvailabilityListener): void {
    this.availabilityListeners.push(listener);
  }

  /** Get the action log */
  getLog(): ActionLog {
    return this.log;
  }

  /**
   * Produce a conflict completion from an escalated conflict.
   */
  produceConflictCompletion(
    concept: string,
    conflict: ConflictInfo,
    flow: string,
  ): ActionCompletion {
    const completion: ActionCompletion = {
      id: generateId(),
      concept,
      action: conflict.relation.replace(/s$/, '') + '/write',
      input: conflict.incoming.fields,
      variant: 'conflict',
      output: {
        key: conflict.key,
        existing: conflict.existing.fields,
        incoming: conflict.incoming.fields,
        existingWrittenAt: conflict.existing.writtenAt,
        incomingWrittenAt: conflict.incoming.writtenAt,
      },
      flow,
      timestamp: timestamp(),
    };

    this.pendingConflicts.push(completion);
    return completion;
  }

  /** Get and clear pending conflict completions. */
  drainConflictCompletions(): ActionCompletion[] {
    const conflicts = [...this.pendingConflicts];
    this.pendingConflicts = [];
    return conflicts;
  }

  /** Get pending conflict completions without clearing. */
  getPendingConflicts(): ActionCompletion[] {
    return [...this.pendingConflicts];
  }

  // --- Private helpers (shared matching logic) ---

  private async evaluateSync(
    sync: CompiledSync,
    completion: ActionCompletion,
  ): Promise<ActionInvocation[]> {
    const flowCompletions = this.log.getCompletionsForFlow(completion.flow);
    const whenBindings = matchWhenClause(sync.when, flowCompletions, completion);

    const allInvocations: ActionInvocation[] = [];

    for (const binding of whenBindings) {
      const matchedIds = binding.__matchedCompletionIds;

      // Firing guard
      if (this.log.hasSyncEdge(matchedIds, sync.name)) continue;
      this.log.addSyncEdgeForMatch(matchedIds, sync.name);

      const whereBindings = await evaluateWhere(
        sync.where, binding, this.registry,
      );

      for (const fullBinding of whereBindings) {
        const invocations = buildInvocations(
          sync.then, fullBinding, completion.flow, sync.name,
        );

        for (const inv of invocations) {
          this.log.appendInvocation(inv, completion.id);
          for (const completionId of matchedIds) {
            this.log.addSyncEdge(completionId, inv.id, sync.name);
          }
        }

        allInvocations.push(...invocations);
      }
    }

    return allInvocations;
  }

  private async evaluateSyncWithFallback(
    sync: CompiledSync,
    completion: ActionCompletion,
  ): Promise<ActionInvocation[]> {
    const targetConcepts = sync.then.map(a => a.concept);
    const unavailable = targetConcepts.filter(uri => !this.registry.resolve(uri));

    if (unavailable.length === 0) {
      return this.evaluateSync(sync, completion);
    }

    // Queue for later evaluation
    const flowCompletions = this.log.getCompletionsForFlow(completion.flow);
    const whenBindings = matchWhenClause(sync.when, flowCompletions, completion);

    for (const binding of whenBindings) {
      const matchedIds = binding.__matchedCompletionIds;

      // Firing guard
      if (this.log.hasSyncEdge(matchedIds, sync.name)) continue;

      this.pendingQueue.push({
        id: generateId(),
        sync,
        binding,
        flow: completion.flow,
        completionId: completion.id,
        timestamp: timestamp(),
        retryCount: 0,
      });
    }

    return [];
  }

  private getReferencedConcepts(sync: CompiledSync): string[] {
    const concepts = new Set<string>();
    for (const pattern of sync.when) {
      concepts.add(pattern.concept);
    }
    for (const action of sync.then) {
      concepts.add(action.concept);
    }
    return [...concepts];
  }
}

// --- SyncEngine Concept Handler Factory ---

/**
 * Create a SyncEngine concept handler.
 *
 * Unlike other concept handlers, this one needs a reference to the
 * ConceptRegistry because the engine needs to query concept state
 * when evaluating where-clauses.
 */
export function createSyncEngineHandler(registry: ConceptRegistry): {
  handler: ConceptHandler;
  engine: SyncEngine;
  log: ActionLog;
} {
  const log = new ActionLog();
  const engine = new SyncEngine(log, registry);

  const handler: ConceptHandler = {
    async registerSync(input, _storage) {
      const sync = input.sync as CompiledSync;

      if (!sync || !sync.name) {
        return { variant: 'error', message: 'Invalid sync: missing name' };
      }

      engine.registerSync(sync);

      return { variant: 'ok' };
    },

    async onCompletion(input, _storage) {
      const completion = input.completion as ActionCompletion;
      const parentId = input.parentId as string | undefined;

      if (!completion || !completion.id) {
        return { variant: 'ok', invocations: [] };
      }

      const invocations = await engine.onCompletion(completion, parentId);

      return { variant: 'ok', invocations };
    },

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
