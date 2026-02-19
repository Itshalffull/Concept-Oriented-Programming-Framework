// ============================================================
// Firestore Durable Action Log
//
// Persists action records and sync edges to Firestore for
// engine state durability and recovery.
//
// Collection design:
//   flows/{flowId}/records/{recordId}
//     - Ordered by timestamp
//   sync-edges/{edgeKey}
//     - For firing guard checks
//
// Firestore TTL policies handle automatic GC.
// ============================================================

import type { ActionRecord } from '../kernel/src/types.js';
import type { DurableActionLog } from './durable-action-log.js';
import { syncEdgeKey } from './durable-action-log.js';
import type { FirestoreClient } from '../infrastructure/storage/firestore-storage.js';

// --- Configuration ---

export interface FirestoreActionLogConfig {
  /** GCP project ID */
  projectId: string;
  /** Collection prefix for action log data */
  collectionPrefix: string;
}

// --- Implementation ---

export function createFirestoreActionLog(
  client: FirestoreClient,
  config: FirestoreActionLogConfig,
): DurableActionLog {
  const prefix = config.collectionPrefix;

  function flowCollection(flowId: string) {
    return client.collection(`${prefix}/flows/${flowId}/records`);
  }

  function edgeCollection() {
    return client.collection(`${prefix}/sync-edges`);
  }

  return {
    async append(record: ActionRecord): Promise<void> {
      const coll = flowCollection(record.flow);
      const docRef = coll.doc(record.id);

      await docRef.set({
        ...record,
        _createdAt: new Date().toISOString(),
      });
    },

    async loadFlow(flowId: string): Promise<ActionRecord[]> {
      const coll = flowCollection(flowId);
      const snapshot = await coll.get();

      if (snapshot.empty) return [];

      return snapshot.docs
        .filter(doc => doc.exists && doc.data() !== undefined)
        .map(doc => {
          const data = doc.data()!;
          return {
            id: data.id as string,
            type: data.type as 'invocation' | 'completion',
            concept: data.concept as string,
            action: data.action as string,
            input: (data.input as Record<string, unknown>) || {},
            variant: data.variant as string | undefined,
            output: data.output as Record<string, unknown> | undefined,
            flow: data.flow as string,
            sync: data.sync as string | undefined,
            parent: data.parent as string | undefined,
            timestamp: data.timestamp as string,
          };
        })
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    },

    async hasSyncEdge(completionIds: string[], syncName: string): Promise<boolean> {
      const edgeId = syncEdgeKey(completionIds, syncName);
      const edgeColl = edgeCollection();
      const docRef = edgeColl.doc(edgeId);
      const doc = await docRef.get();
      return doc.exists;
    },

    async addSyncEdge(completionId: string, invocationId: string, syncName: string): Promise<void> {
      const edgeId = syncEdgeKey([completionId], `${syncName}:${invocationId}`);
      const edgeColl = edgeCollection();
      const docRef = edgeColl.doc(edgeId);

      await docRef.set({
        completionId,
        invocationId,
        syncName,
        timestamp: new Date().toISOString(),
      });
    },

    async addSyncEdgeForMatch(matchedIds: string[], syncName: string): Promise<void> {
      const edgeId = syncEdgeKey(matchedIds, syncName);
      const edgeColl = edgeCollection();
      const docRef = edgeColl.doc(edgeId);

      await docRef.set({
        matchedIds: [...matchedIds].sort(),
        syncName,
        timestamp: new Date().toISOString(),
      });
    },

    async gc(olderThan: Date): Promise<number> {
      const cutoff = olderThan.toISOString();
      let deleted = 0;

      // Query flows collection for old records
      // This is simplified — in production, iterate over flow subcollections
      const edgeColl = edgeCollection();
      const oldEdges = edgeColl.where('timestamp', '<', cutoff);
      const snapshot = await oldEdges.get();

      for (const doc of snapshot.docs) {
        if (doc.exists && doc.data()) {
          const data = doc.data()!;
          const edgeKey = syncEdgeKey(
            (data.matchedIds as string[]) || [data.completionId as string],
            data.syncName as string,
          );
          await edgeCollection().doc(edgeKey).delete();
          deleted++;
        }
      }

      return deleted;
    },
  };
}
