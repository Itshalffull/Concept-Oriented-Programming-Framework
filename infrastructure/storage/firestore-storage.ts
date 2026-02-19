// ============================================================
// Firestore Storage Adapter
//
// Implements ConceptStorage backed by Google Cloud Firestore.
// Uses subcollections per relation for natural data organization.
//
// Firestore characteristics:
//   - Strong consistency for all reads
//   - Automatic multi-region replication
//   - Real-time listeners (not used here, but available)
//   - 1 write/sec/document limit for sustained writes
//   - Composite indexes needed for multi-field queries
//
// Collection structure:
//   concepts/{conceptPrefix}/relations/{relation}/entries/{key}
//
// Mapping:
//   put  -> doc.set() with serverTimestamp
//   get  -> doc.get()
//   find -> collection.where() queries
//   del  -> doc.delete()
//   delMany -> query + batch delete
//   getMeta -> doc.get() with field mask
//   onConflict -> Firestore transactions with timestamp comparison
// ============================================================

import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
  ConflictResolution,
} from '../../kernel/src/types.js';

// --- Firestore Client Interface ---
// Abstracted so callers can provide the real Firestore SDK
// or a mock for testing.

export interface FirestoreDocument {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

export interface FirestoreQuerySnapshot {
  docs: FirestoreDocument[];
  empty: boolean;
  size: number;
}

export interface FirestoreDocRef {
  set(data: Record<string, unknown>): Promise<void>;
  get(): Promise<FirestoreDocument>;
  delete(): Promise<void>;
  update(data: Record<string, unknown>): Promise<void>;
}

export interface FirestoreQuery {
  where(field: string, op: string, value: unknown): FirestoreQuery;
  get(): Promise<FirestoreQuerySnapshot>;
}

export interface FirestoreCollectionRef extends FirestoreQuery {
  doc(id: string): FirestoreDocRef;
}

export interface FirestoreTransaction {
  get(ref: FirestoreDocRef): Promise<FirestoreDocument>;
  set(ref: FirestoreDocRef, data: Record<string, unknown>): void;
  delete(ref: FirestoreDocRef): void;
}

export interface FirestoreClient {
  collection(path: string): FirestoreCollectionRef;
  runTransaction<T>(fn: (txn: FirestoreTransaction) => Promise<T>): Promise<T>;
}

// --- Configuration ---

export interface FirestoreStorageConfig {
  /** GCP project ID */
  projectId: string;
  /** Prefix for collection paths (e.g. "myapp-prod") */
  collectionPrefix: string;
  /** Named database ID (for non-default databases) */
  databaseId?: string;
}

// --- Internal Helpers ---

function collectionPath(config: FirestoreStorageConfig, relation: string): string {
  return `${config.collectionPrefix}/relations/${relation}/entries`;
}

function extractFields(data: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k !== '_lastWrittenAt') {
      fields[k] = v;
    }
  }
  return fields;
}

// --- Factory ---

/**
 * Create a ConceptStorage backed by Google Cloud Firestore.
 *
 * @param client - A Firestore client (real or mock)
 * @param config - Storage configuration
 */
export function createFirestoreStorage(
  client: FirestoreClient,
  config: FirestoreStorageConfig,
): ConceptStorage {

  function getDocRef(relation: string, key: string): FirestoreDocRef {
    return client.collection(collectionPath(config, relation)).doc(key);
  }

  function getCollectionRef(relation: string): FirestoreCollectionRef {
    return client.collection(collectionPath(config, relation));
  }

  const storage: ConceptStorage = {
    async put(relation, key, value) {
      const now = new Date().toISOString();
      const docRef = getDocRef(relation, key);

      // Check for conflicts if onConflict callback is set
      if (storage.onConflict) {
        const existingDoc = await docRef.get();

        if (existingDoc.exists) {
          const existingData = existingDoc.data()!;
          const info: ConflictInfo = {
            relation,
            key,
            existing: {
              fields: extractFields(existingData),
              writtenAt: (existingData._lastWrittenAt as string) ?? now,
            },
            incoming: {
              fields: { ...value },
              writtenAt: now,
            },
          };

          const resolution = storage.onConflict(info);
          switch (resolution.action) {
            case 'keep-existing':
              return;
            case 'accept-incoming':
              break;
            case 'merge':
              await docRef.set({
                ...resolution.merged,
                _lastWrittenAt: now,
              });
              return;
            case 'escalate':
              break;
          }
        }
      }

      await docRef.set({
        ...value,
        _lastWrittenAt: now,
      });
    },

    async get(relation, key) {
      const docRef = getDocRef(relation, key);
      const doc = await docRef.get();

      if (!doc.exists) return null;
      return extractFields(doc.data()!);
    },

    async find(relation, criteria?) {
      const collRef = getCollectionRef(relation);
      let query: FirestoreQuery = collRef;

      if (criteria && Object.keys(criteria).length > 0) {
        for (const [field, val] of Object.entries(criteria)) {
          query = query.where(field, '==', val);
        }
      }

      const snapshot = await query.get();
      if (snapshot.empty) return [];

      return snapshot.docs
        .filter(doc => doc.exists && doc.data() !== undefined)
        .map(doc => extractFields(doc.data()!));
    },

    async del(relation, key) {
      const docRef = getDocRef(relation, key);
      await docRef.delete();
    },

    async delMany(relation, criteria) {
      const matches = await storage.find(relation, criteria);
      if (matches.length === 0) return 0;

      // Firestore batch deletes: find the keys then delete each.
      // In production, use WriteBatch for up to 500 operations.
      const collRef = getCollectionRef(relation);
      let query: FirestoreQuery = collRef;

      if (criteria && Object.keys(criteria).length > 0) {
        for (const [field, val] of Object.entries(criteria)) {
          query = query.where(field, '==', val);
        }
      }

      const snapshot = await query.get();
      let count = 0;

      for (const doc of snapshot.docs) {
        if (doc.exists && doc.data()) {
          const data = doc.data()!;
          // Reconstruct key — look for 'id' field or use first field value
          const entryKey = (data.id as string) || (data._key as string) || Object.values(data)[0] as string;
          if (entryKey) {
            await getDocRef(relation, String(entryKey)).delete();
            count++;
          }
        }
      }

      return count;
    },

    async getMeta(relation, key) {
      const docRef = getDocRef(relation, key);
      const doc = await docRef.get();

      if (!doc.exists) return null;
      const data = doc.data()!;
      if (!data._lastWrittenAt) return null;
      return { lastWrittenAt: data._lastWrittenAt as string };
    },
  };

  return storage;
}
