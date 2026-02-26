// ============================================================
// Durable Action Log Interface
//
// Extends the in-memory action log with persistence for serverless
// engine topologies. The engine's existing ActionLog stays as the
// hot path; this adds write-through and recovery.
//
// Required for per-request and event-driven engine topologies.
// Optional (durability backup) for persistent engine topology.
//
// The DurableActionLog persists action records to shared storage
// (DynamoDB/Firestore) so that:
//   1. Per-request engines can recover flow state on cold start
//   2. Event-driven engines can coordinate across instances
//   3. Persistent engines can recover from restarts
// ============================================================

import type { ActionRecord } from '../types.js';

// --- Durable Action Log Interface ---

export interface DurableActionLog {
  /** Append a record and persist it atomically. */
  append(record: ActionRecord): Promise<void>;

  /** Recover log entries for a flow (for per-request engine cold start). */
  loadFlow(flowId: string): Promise<ActionRecord[]>;

  /** Query provenance edges for firing guard checks. */
  hasSyncEdge(completionIds: string[], syncName: string): Promise<boolean>;

  /** Record a provenance edge. */
  addSyncEdge(completionId: string, invocationId: string, syncName: string): Promise<void>;

  /** Record a match-level provenance edge (for multi-completion matches). */
  addSyncEdgeForMatch(matchedIds: string[], syncName: string): Promise<void>;

  /** Garbage collect completed flows older than retention period. */
  gc(olderThan: Date): Promise<number>;
}

// --- Action Log Record with Persistence Key ---

export interface PersistedActionRecord extends ActionRecord {
  /** Persistence key: flow#{flowId} */
  pk: string;
  /** Sort key: {timestamp}#{id} */
  sk: string;
}

// --- Helpers ---

export function toPersistenceKey(record: ActionRecord): PersistedActionRecord {
  return {
    ...record,
    pk: `flow#${record.flow}`,
    sk: `${record.timestamp}#${record.id}`,
  };
}

export function syncEdgeKey(completionIds: string[], syncName: string): string {
  return `edge#${[...completionIds].sort().join('|')}#${syncName}`;
}
