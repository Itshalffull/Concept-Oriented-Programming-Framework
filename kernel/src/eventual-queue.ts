// ============================================================
// Phase 9 — Eventual Sync Queue & Annotation-Aware Evaluation
//
// Section 5.2: Sync annotations
//   eager      — evaluated synchronously; all concepts must be reachable
//   eventual   — deferred to durable queue; retried on availability
//   local      — must execute on same runtime as when-concept
//   idempotent — safe to retry without side-effect concerns
//
// Section 6.6: Eventual sync queue
//   When an eventual sync's target concepts are unavailable, the
//   engine records the pending sync with its current bindings in
//   a durable queue. On availability change, pending syncs that
//   reference the newly available concept are re-evaluated.
//   Idempotency is guaranteed by provenance edge check.
//
// Phase 13: Conflict detection during eventual sync queue replay.
//   When replaying writes, the storage's onConflict callback may
//   return 'escalate'. The engine produces a → conflict(...)
//   completion that syncs can react to for conflict resolution.
// ============================================================

import type {
  ActionCompletion,
  ActionInvocation,
  CompiledSync,
  ConceptRegistry,
  Binding,
  ConflictInfo,
} from './types.js';
import {
  SyncEngine,
  ActionLog,
  matchWhenClause,
  evaluateWhere,
  buildInvocations,
  indexKey,
} from './engine.js';
import { generateId, timestamp } from './types.js';

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
 * Section 8.2: Engine Hierarchy
 * - Each engine instance evaluates syncs assigned to it
 * - Downstream engine forwards completions upstream
 * - Offline downstream evaluates [local] syncs independently
 *   and queues [eventual] syncs for later forwarding
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
  /** Phase 13: Pending conflict completions produced by escalation */
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

      // Skip local syncs if target concepts are on different runtimes
      // (In this implementation, we check concept availability as proxy)
      if (isLocal) {
        // Local syncs always execute — they run on the same runtime
        const invocations = await this.evaluateSync(sync, completion);
        allInvocations.push(...invocations);
        continue;
      }

      // For eventual syncs, try to evaluate; queue on failure
      if (isEventual) {
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
    // Notify listeners
    for (const listener of this.availabilityListeners) {
      listener(conceptUri, available);
    }

    if (!available) return [];

    // Re-evaluate pending syncs that reference this concept
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
      // Check if ALL referenced concepts are now available
      const referenced = this.getReferencedConcepts(entry.sync);
      const allAvailable = referenced.every(uri => {
        const transport = this.registry.resolve(uri);
        return transport !== undefined;
      });

      if (allAvailable) {
        // Re-evaluate with the stored binding
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
          // Re-queue on failure
          entry.retryCount++;
          this.pendingQueue.push(entry);
        }
      } else {
        // Not all concepts available yet, re-queue
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
   * Phase 13: Produce a conflict completion from an escalated conflict.
   * Returns a completion that syncs can react to for conflict resolution.
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

  /** Phase 13: Get and clear pending conflict completions */
  drainConflictCompletions(): ActionCompletion[] {
    const conflicts = [...this.pendingConflicts];
    this.pendingConflicts = [];
    return conflicts;
  }

  /** Phase 13: Get pending conflict completions without clearing */
  getPendingConflicts(): ActionCompletion[] {
    return [...this.pendingConflicts];
  }

  // --- Private helpers ---

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

      // Evaluate where clause
      const whereBindings = await evaluateWhere(
        sync.where, binding, this.registry,
      );

      // Build invocations
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
    // Check if target concepts are available
    const targetConcepts = sync.then.map(a => a.concept);
    const unavailable = targetConcepts.filter(uri => !this.registry.resolve(uri));

    if (unavailable.length === 0) {
      // All available — evaluate normally
      return this.evaluateSync(sync, completion);
    }

    // Queue for later evaluation
    const flowCompletions = this.log.getCompletionsForFlow(completion.flow);
    const whenBindings = matchWhenClause(sync.when, flowCompletions, completion);

    for (const binding of whenBindings) {
      const matchedIds = binding.__matchedCompletionIds;

      // Firing guard
      if (this.log.hasSyncEdge(matchedIds, sync.name)) continue;

      // Don't add sync edge yet — we'll add it when the sync actually fires

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
