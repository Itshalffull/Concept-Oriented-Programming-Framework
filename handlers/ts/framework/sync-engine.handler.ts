// @migrated dsl-constructs 2026-03-18
// ============================================================
// SyncEngine Concept Implementation
//
// Wraps the kernel's SyncEngine and ActionLog as concept actions.
// Includes annotation-aware routing (eager/eventual/local) and
// the eventual sync queue with conflict production.
//
// Note: This handler retains its class-based DistributedSyncEngine
// and factory pattern because the sync engine requires stateful
// class instances (ActionLog, ConceptRegistry) that cannot be
// expressed as pure StorageProgram instructions. The concept
// handler actions themselves are converted to functional style.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import type { ConceptHandler } from '../../../runtime/types.js';
import {
  createProgram, complete, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type {
  CompiledSync,
  ActionCompletion,
  ActionInvocation,
  ConceptRegistry,
  Binding,
  ConflictInfo,
} from '../../../runtime/types.js';
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
import { generateId, timestamp } from '../../../runtime/types.js';

// Re-export engine classes and functions
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

// --- DistributedSyncEngine (unchanged — stateful class) ---

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

  constructor(log: ActionLog, registry: ConceptRegistry, runtimeId: string = 'default') {
    this.log = log; this.registry = registry; this.runtimeId = runtimeId;
  }

  setUpstream(upstream: DistributedSyncEngine): void { this.upstreamEngine = upstream; }
  addCompletionForwarder(forwarder: (completion: ActionCompletion) => Promise<void>): void { this.completionForwarders.push(forwarder); }

  private getWildcardCandidates(concept: string, action: string): Set<CompiledSync> {
    const result = new Set<CompiledSync>();
    for (const [key, syncs] of this.syncIndex) {
      if (!key.includes('?')) continue;
      const [patConcept, patAction] = key.split(':');
      if ((patConcept.startsWith('?') || patConcept === concept) && (patAction.startsWith('?') || patAction === action))
        for (const s of syncs) result.add(s);
    }
    return result;
  }

  registerSync(sync: CompiledSync): void {
    this.syncs.push(sync);
    for (const pattern of sync.when) { const key = indexKey(pattern.concept, pattern.action); let set = this.syncIndex.get(key); if (!set) { set = new Set(); this.syncIndex.set(key, set); } set.add(sync); }
  }

  getPendingQueue(): PendingSyncEntry[] { return [...this.pendingQueue]; }
  getRuntimeId(): string { return this.runtimeId; }

  async onCompletion(completion: ActionCompletion, parentId?: string): Promise<ActionInvocation[]> {
    this.log.append(completion, parentId);
    for (const forwarder of this.completionForwarders) await forwarder(completion);
    const key = indexKey(completion.concept, completion.action);
    const exactCandidates = this.syncIndex.get(key);
    const wildcardCandidates = this.getWildcardCandidates(completion.concept, completion.action);
    if (!exactCandidates && wildcardCandidates.size === 0) return [];
    const candidates = new Set<CompiledSync>();
    if (exactCandidates) for (const s of exactCandidates) candidates.add(s);
    for (const s of wildcardCandidates) candidates.add(s);
    const allInvocations: ActionInvocation[] = [];
    for (const sync of candidates) {
      const annotations = sync.annotations || [];
      if (annotations.includes('local')) { allInvocations.push(...await this.evaluateSync(sync, completion)); continue; }
      if (annotations.includes('eventual')) { allInvocations.push(...await this.evaluateSyncWithFallback(sync, completion)); continue; }
      allInvocations.push(...await this.evaluateSync(sync, completion));
    }
    return allInvocations;
  }

  async onAvailabilityChange(conceptUri: string, available: boolean): Promise<ActionInvocation[]> {
    for (const listener of this.availabilityListeners) listener(conceptUri, available);
    if (!available) return [];
    const toRetry: PendingSyncEntry[] = []; const remaining: PendingSyncEntry[] = [];
    for (const entry of this.pendingQueue) { if (this.getReferencedConcepts(entry.sync).includes(conceptUri)) toRetry.push(entry); else remaining.push(entry); }
    this.pendingQueue = remaining;
    const allInvocations: ActionInvocation[] = [];
    for (const entry of toRetry) {
      const allAvailable = this.getReferencedConcepts(entry.sync).every(uri => this.registry.resolve(uri) !== undefined);
      if (allAvailable) {
        try {
          const whereBindings = await evaluateWhere(entry.sync.where, entry.binding, this.registry);
          for (const fullBinding of whereBindings) { const invocations = buildInvocations(entry.sync.then, fullBinding, entry.flow, entry.sync.name); for (const inv of invocations) this.log.appendInvocation(inv, entry.completionId); allInvocations.push(...invocations); }
        } catch { entry.retryCount++; this.pendingQueue.push(entry); }
      } else { this.pendingQueue.push(entry); }
    }
    return allInvocations;
  }

  onAvailability(listener: AvailabilityListener): void { this.availabilityListeners.push(listener); }
  getLog(): ActionLog { return this.log; }

  produceConflictCompletion(concept: string, conflict: ConflictInfo, flow: string): ActionCompletion {
    const completion: ActionCompletion = { id: generateId(), concept, action: conflict.relation.replace(/s$/, '') + '/write', input: conflict.incoming.fields, variant: 'conflict', output: { key: conflict.key, existing: conflict.existing.fields, incoming: conflict.incoming.fields, existingWrittenAt: conflict.existing.writtenAt, incomingWrittenAt: conflict.incoming.writtenAt }, flow, timestamp: timestamp() };
    this.pendingConflicts.push(completion);
    return completion;
  }

  drainConflictCompletions(): ActionCompletion[] { const conflicts = [...this.pendingConflicts]; this.pendingConflicts = []; return conflicts; }
  getPendingConflicts(): ActionCompletion[] { return [...this.pendingConflicts]; }

  private async evaluateSync(sync: CompiledSync, completion: ActionCompletion): Promise<ActionInvocation[]> {
    const flowCompletions = this.log.getCompletionsForFlow(completion.flow);
    const whenBindings = matchWhenClause(sync.when, flowCompletions, completion);
    const allInvocations: ActionInvocation[] = [];
    for (const binding of whenBindings) {
      const matchedIds = binding.__matchedCompletionIds;
      if (this.log.hasSyncEdge(matchedIds, sync.name)) continue;
      this.log.addSyncEdgeForMatch(matchedIds, sync.name);
      const whereBindings = await evaluateWhere(sync.where, binding, this.registry);
      for (const fullBinding of whereBindings) {
        const invocations = buildInvocations(sync.then, fullBinding, completion.flow, sync.name);
        for (const inv of invocations) { this.log.appendInvocation(inv, completion.id); for (const completionId of matchedIds) this.log.addSyncEdge(completionId, inv.id, sync.name); }
        allInvocations.push(...invocations);
      }
    }
    return allInvocations;
  }

  private async evaluateSyncWithFallback(sync: CompiledSync, completion: ActionCompletion): Promise<ActionInvocation[]> {
    const unavailable = sync.then.map(a => a.concept).filter(uri => !this.registry.resolve(uri));
    if (unavailable.length === 0) return this.evaluateSync(sync, completion);
    const flowCompletions = this.log.getCompletionsForFlow(completion.flow);
    const whenBindings = matchWhenClause(sync.when, flowCompletions, completion);
    for (const binding of whenBindings) {
      const matchedIds = binding.__matchedCompletionIds;
      if (this.log.hasSyncEdge(matchedIds, sync.name)) continue;
      this.pendingQueue.push({ id: generateId(), sync, binding, flow: completion.flow, completionId: completion.id, timestamp: timestamp(), retryCount: 0 });
    }
    return [];
  }

  private getReferencedConcepts(sync: CompiledSync): string[] {
    const concepts = new Set<string>();
    for (const pattern of sync.when) concepts.add(pattern.concept);
    for (const action of sync.then) concepts.add(action.concept);
    return [...concepts];
  }
}

// --- SyncEngine Concept Handler Factory ---

type Result = { variant: string; [key: string]: unknown };

export function createSyncEngineHandler(registry: ConceptRegistry): {
  handler: ReturnType<typeof autoInterpret>;
  engine: SyncEngine;
  log: ActionLog;
} {
  const log = new ActionLog();
  const engine = new SyncEngine(log, registry);

  // onCompletion and evaluateWhere require stateful engine calls that
  // cannot be expressed as pure StorageProgram instructions. These use
  // imperative style while registerSync uses functional style.
  const _functionalHandler: FunctionalConceptHandler = {
    registerSync(input: Record<string, unknown>) {
      const sync = input.sync as CompiledSync;
      if (!sync || !sync.name) {
        const p = createProgram();
        return complete(p, 'error', { message: 'Invalid sync: missing name' }) as StorageProgram<Result>;
      }
      engine.registerSync(sync);
      const p = createProgram();
      return complete(p, 'ok', {}) as StorageProgram<Result>;
    },
  };

  const baseHandler = autoInterpret(_functionalHandler);

  // Combine functional registerSync with imperative onCompletion/evaluateWhere
  const handler: ConceptHandler & FunctionalConceptHandler & { [key: string]: unknown } = {
    ...baseHandler,

    async onCompletion(input: Record<string, unknown>, _storage?: unknown) {
      const completion = input.completion as ActionCompletion;
      const parentId = input.parentId as string | undefined;
      if (!completion || !completion.id) {
        return { variant: 'ok', invocations: [] };
      }
      const invocations = await engine.onCompletion(completion, parentId);
      return { variant: 'ok', invocations };
    },

    async evaluateWhere(input: Record<string, unknown>, _storage?: unknown) {
      const bindings = input.bindings as Binding;
      const queries = input.queries as CompiledSync['where'];
      if (!bindings || !queries) {
        return { variant: 'error', message: 'Missing bindings or queries' };
      }
      const results = await evaluateWhere(queries, bindings, registry);
      return { variant: 'ok', results };
    },
  } as any;

  return { handler, engine, log };
}

// --- Static handler for conformance testing ---

const _testRegistry: ConceptRegistry = {
  register() {},
  resolve() { return undefined; },
  available() { return false; },
};

export const syncEngineHandler = createSyncEngineHandler(_testRegistry).handler;
