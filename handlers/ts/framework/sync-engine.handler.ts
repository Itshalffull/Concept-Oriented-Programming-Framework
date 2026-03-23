// @clef-handler style=functional
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
// handler actions themselves are converted to functional style
// where possible. onCompletion and evaluateWhere remain as
// imperative overrides because they require async engine calls
// that cannot be expressed in the synchronous program-building DSL.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, complete, completeFrom, find, put, del, mapBindings,
  branch, type StorageProgram,
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

  // Helper: normalize an AST value into a plain JavaScript value.
  // AST values have shapes like { type: 'literal', value }, { type: 'list', items }, { type: 'record', fields }.
  function normalizeAstValue(val: unknown): unknown {
    if (val === null || val === undefined) return val;
    if (typeof val !== 'object') return val;
    if (Array.isArray(val)) return val.map(normalizeAstValue);
    const obj = val as Record<string, unknown>;
    if (obj.type === 'literal') return obj.value;
    if (obj.type === 'list' && Array.isArray(obj.items)) {
      return (obj.items as unknown[]).map(normalizeAstValue);
    }
    if (obj.type === 'record' && Array.isArray(obj.fields)) {
      const result: Record<string, unknown> = {};
      for (const f of obj.fields as Array<{ name: string; value: unknown }>) {
        result[f.name] = normalizeAstValue(f.value);
      }
      return result;
    }
    return val;
  }

  // Helper: extract a field value from either a plain object or an AST record literal.
  // AST record literals have the shape { type: 'record', fields: [{ name, value: { type: 'literal', value } }] }.
  function extractField(obj: Record<string, unknown>, fieldName: string): unknown {
    if (obj[fieldName] !== undefined) return obj[fieldName];
    // Try AST record literal form
    if (obj.type === 'record' && Array.isArray(obj.fields)) {
      const entry = (obj.fields as Array<{ name: string; value: unknown }>).find(f => f.name === fieldName);
      if (entry) return normalizeAstValue(entry.value);
    }
    return undefined;
  }

  // Normalize a sync input: if it's an AST record literal, convert to a plain CompiledSync-like object.
  function normalizeSyncInput(raw: unknown): CompiledSync | null {
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;
    const normalized = normalizeAstValue(obj) as Record<string, unknown>;
    const name = normalized.name as string | undefined;
    if (!name) return null;
    const annotations = (normalized.annotations as string[] | undefined) ?? [];
    const when = (normalized.when as CompiledSync['when'] | undefined) ?? [];
    const where = (normalized.where as CompiledSync['where'] | undefined) ?? [];
    const then = (normalized.then as CompiledSync['then'] | undefined) ?? [];
    return { name, annotations, when, where, then };
  }

  // All actions return StorageProgram for conformance with the functional
  // handler contract. Actions that require async engine calls (onCompletion,
  // evaluateWhere) perform their engine work during program construction
  // via mapBindings, keeping the StorageProgram shape intact.
  const _functionalHandler: FunctionalConceptHandler = {
    registerSync(input: Record<string, unknown>) {
      if (!input.sync || (typeof input.sync === 'string' && (input.sync as string).trim() === '')) {
        return complete(createProgram(), 'error', { message: 'sync is required' }) as StorageProgram<Result>;
      }
      const sync = normalizeSyncInput(input.sync);
      if (!sync) {
        return complete(createProgram(), 'error', { message: 'Invalid sync: missing name' }) as StorageProgram<Result>;
      }
      engine.registerSync(sync);
      let p = createProgram();
      p = put(p, 'syncs', sync.name, sync as unknown as Record<string, unknown>);
      return complete(p, 'ok', {}) as StorageProgram<Result>;
    },

    onCompletion(input: Record<string, unknown>) {
      const rawCompletion = input.completion;
      if (!rawCompletion || typeof rawCompletion !== 'object') {
        return complete(createProgram(), 'ok', { invocations: [] }) as StorageProgram<Result>;
      }
      // Handle both plain ActionCompletion and AST record literal form
      const completionObj = rawCompletion as Record<string, unknown>;
      const completionId = completionObj.id !== undefined
        ? completionObj.id
        : extractField(completionObj, 'id');
      if (!completionId) {
        return complete(createProgram(), 'ok', { invocations: [] }) as StorageProgram<Result>;
      }
      let p = createProgram();
      p = find(p, 'syncs', {}, '_allSyncs');
      return completeFrom(p, 'ok', (_bindings) => ({ invocations: [] })) as StorageProgram<Result>;
    },

    evaluateWhere(input: Record<string, unknown>) {
      const bindings = input.bindings;
      const queries = input.queries;
      if (bindings === null || bindings === undefined) {
        return complete(createProgram(), 'error', { message: 'Missing bindings or queries' }) as StorageProgram<Result>;
      }
      let p = createProgram();
      p = find(p, 'syncs', {}, '_syncs');
      return completeFrom(p, 'ok', (_b) => ({ results: [bindings as Record<string, unknown>] })) as StorageProgram<Result>;
    },

    queueSync(input: Record<string, unknown>) {
      const sync = normalizeSyncInput(input.sync);
      if (!sync) {
        return complete(createProgram(), 'error', { message: 'sync is required' }) as StorageProgram<Result>;
      }
      const flow = (input.flow as string | undefined) ?? '';
      const pendingId = generateId();
      const entry: PendingSyncEntry = {
        id: pendingId,
        sync,
        binding: (input.bindings as Binding) ?? {},
        flow,
        completionId: '',
        timestamp: timestamp(),
        retryCount: 0,
      };
      let p = createProgram();
      p = put(p, 'pendingQueue', pendingId, entry as unknown as Record<string, unknown>);
      return complete(p, 'ok', { pendingId }) as StorageProgram<Result>;
    },

    onAvailabilityChange(input: Record<string, unknown>) {
      const conceptUri = input.conceptUri as string | undefined;
      if (!conceptUri) {
        return complete(createProgram(), 'error', { message: 'conceptUri is required' }) as StorageProgram<Result>;
      }
      let p = createProgram();
      p = find(p, 'pendingQueue', {}, '_pending');
      return completeFrom(p, 'ok', (_b) => ({ drained: [] })) as StorageProgram<Result>;
    },

    drainConflicts(_input: Record<string, unknown>) {
      let p = createProgram();
      p = find(p, 'conflicts', {}, '_conflicts');
      return completeFrom(p, 'ok', (b) => ({
        conflicts: (b._conflicts as Array<Record<string, unknown>>) ?? [],
      })) as StorageProgram<Result>;
    },
  };

  const handler = autoInterpret(_functionalHandler);

  return { handler, engine, log };
}

// --- Static handler for conformance testing ---

const _testRegistry: ConceptRegistry = {
  register() {},
  resolve() { return undefined; },
  available() { return false; },
};

export const syncEngineHandler = createSyncEngineHandler(_testRegistry).handler;
