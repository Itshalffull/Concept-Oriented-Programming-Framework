// ============================================================
// Distributed Firing Guard
//
// Multiple Lambda/GCF instances may process completions for the
// same flow simultaneously. The firing guard prevents duplicate
// sync firings using atomic conditional writes in shared storage.
//
// DynamoDB: conditional PutItem — if the edge already exists,
//   the write fails and the sync is skipped.
// Firestore: transaction that reads edge existence + writes
//   edge atomically.
//
// This is the distributed equivalent of the in-memory
// ActionLog.hasSyncEdge() check.
// ============================================================

import type { DynamoDBDocumentClient } from '../dynamodb-storage.js';
import type { FirestoreClient } from '../firestore-storage.js';

// --- Interface ---

export interface DistributedFiringGuard {
  /**
   * Atomically check + record that this sync fired for these completions.
   * Returns true if the guard was acquired (sync should fire).
   * Returns false if already fired (sync should be skipped).
   */
  tryAcquire(completionIds: string[], syncName: string): Promise<boolean>;
}

// --- Edge Key ---

function edgeKey(completionIds: string[], syncName: string): string {
  return `guard#${[...completionIds].sort().join('|')}#${syncName}`;
}

// --- DynamoDB Implementation ---

export interface DynamoDBFiringGuardConfig {
  /** Table name for guard entries */
  tableName: string;
  /** TTL in seconds (default: 1 hour) */
  ttlSeconds?: number;
}

/**
 * DynamoDB-based distributed firing guard.
 * Uses conditional PutItem with attribute_not_exists to ensure
 * exactly-once acquisition.
 */
export function createDynamoDBFiringGuard(
  client: DynamoDBDocumentClient,
  config: DynamoDBFiringGuardConfig,
): DistributedFiringGuard {
  const ttlSeconds = config.ttlSeconds ?? 3600;

  return {
    async tryAcquire(completionIds: string[], syncName: string): Promise<boolean> {
      const pk = edgeKey(completionIds, syncName);
      const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;

      try {
        await client.put({
          TableName: config.tableName,
          Item: {
            pk,
            sk: 'guard',
            completionIds: [...completionIds].sort(),
            syncName,
            acquiredAt: new Date().toISOString(),
            _ttl: ttl,
          },
          ConditionExpression: 'attribute_not_exists(pk)',
        });
        return true;
      } catch (err: unknown) {
        // ConditionalCheckFailedException means the guard was already acquired
        if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
          return false;
        }
        // For our mock, check for a simulated condition failure
        if (err instanceof Error && err.message === 'ConditionalCheckFailed') {
          return false;
        }
        throw err;
      }
    },
  };
}

// --- Firestore Implementation ---

export interface FirestoreFiringGuardConfig {
  /** Collection path for guard entries */
  collectionPath: string;
}

/**
 * Firestore-based distributed firing guard.
 * Uses transactions to atomically read + write guard entries.
 */
export function createFirestoreFiringGuard(
  client: FirestoreClient,
  config: FirestoreFiringGuardConfig,
): DistributedFiringGuard {
  return {
    async tryAcquire(completionIds: string[], syncName: string): Promise<boolean> {
      const docId = edgeKey(completionIds, syncName);
      const docRef = client.collection(config.collectionPath).doc(docId);

      try {
        return await client.runTransaction(async (txn) => {
          const doc = await txn.get(docRef);

          if (doc.exists) {
            // Guard already acquired — skip this sync
            return false;
          }

          // Acquire the guard
          txn.set(docRef, {
            completionIds: [...completionIds].sort(),
            syncName,
            acquiredAt: new Date().toISOString(),
          });

          return true;
        });
      } catch {
        // Transaction conflicts are treated as "already acquired"
        return false;
      }
    },
  };
}
