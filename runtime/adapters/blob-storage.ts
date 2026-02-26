// ============================================================
// S3/GCS Blob Storage Adapter
//
// Implements ConceptStorage for concepts that store large values
// (documents, media, ML model artifacts). Uses a mutable-index-
// over-immutable-objects pattern:
//   - Object data stored in S3/GCS bucket
//   - Metadata index maintained in DynamoDB/Firestore
//
// Mapping:
//   put  -> upload object to bucket, update metadata index
//   get  -> resolve from index, fetch object
//   find -> query index (delegates to index storage adapter)
//   del  -> delete object + remove from index
//   getMeta -> query index metadata
//
// Supports presigned URLs for concepts that serve content.
// ============================================================

import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
  ConflictResolution,
} from '../types.js';

// --- Blob Client Interface ---

export interface BlobClient {
  putObject(params: {
    bucket: string;
    key: string;
    body: string;
    contentType?: string;
  }): Promise<void>;

  getObject(params: {
    bucket: string;
    key: string;
  }): Promise<{ body: string; contentType?: string } | null>;

  deleteObject(params: {
    bucket: string;
    key: string;
  }): Promise<void>;

  getPresignedUrl?(params: {
    bucket: string;
    key: string;
    expiresIn: number;  // seconds
  }): Promise<string>;
}

// --- Configuration ---

export interface BlobStorageConfig {
  /** Cloud provider */
  provider: 's3' | 'gcs';
  /** Bucket name */
  bucket: string;
  /** AWS/GCP region */
  region?: string;
  /** Index storage for metadata lookups */
  indexStorage: ConceptStorage;
  /** TTL in seconds for presigned URLs (default: 3600) */
  presignedUrlTtl?: number;
  /** Key prefix in the bucket */
  keyPrefix?: string;
}

// --- Internal Helpers ---

function objectKey(config: BlobStorageConfig, relation: string, key: string): string {
  const prefix = config.keyPrefix ? `${config.keyPrefix}/` : '';
  return `${prefix}${relation}/${key}`;
}

// Index relation name — stored in the index storage adapter
function indexRelation(relation: string): string {
  return `_blob_index_${relation}`;
}

// --- Factory ---

/**
 * Create a ConceptStorage backed by S3/GCS for object data
 * with a metadata index in DynamoDB/Firestore.
 *
 * @param blobClient - S3 or GCS client (real or mock)
 * @param config - Blob storage configuration
 */
export function createBlobStorage(
  blobClient: BlobClient,
  config: BlobStorageConfig,
): ConceptStorage {
  const { indexStorage } = config;

  const storage: ConceptStorage = {
    async put(relation, key, value) {
      const now = new Date().toISOString();
      const objKey = objectKey(config, relation, key);

      // Upload object to blob storage
      await blobClient.putObject({
        bucket: config.bucket,
        key: objKey,
        body: JSON.stringify(value),
        contentType: 'application/json',
      });

      // Update metadata index
      const indexEntry: Record<string, unknown> = {
        objectKey: objKey,
        relation,
        entryKey: key,
        size: JSON.stringify(value).length,
        contentType: 'application/json',
        _lastWrittenAt: now,
      };

      // Copy searchable fields from value into index
      for (const [field, val] of Object.entries(value)) {
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
          indexEntry[field] = val;
        }
      }

      // Handle conflict detection via index storage
      if (storage.onConflict) {
        indexStorage.onConflict = storage.onConflict;
      }

      await indexStorage.put(indexRelation(relation), key, indexEntry);
    },

    async get(relation, key) {
      const objKey = objectKey(config, relation, key);

      // Check index first
      const indexEntry = await indexStorage.get(indexRelation(relation), key);
      if (!indexEntry) return null;

      // Fetch from blob storage
      const result = await blobClient.getObject({
        bucket: config.bucket,
        key: objKey,
      });

      if (!result) return null;
      return JSON.parse(result.body);
    },

    async find(relation, criteria?) {
      // Query the metadata index
      const indexEntries = await indexStorage.find(indexRelation(relation), criteria);

      if (indexEntries.length === 0) return [];

      // Fetch each object from blob storage
      const results: Record<string, unknown>[] = [];
      for (const entry of indexEntries) {
        const objKey = entry.objectKey as string;
        const result = await blobClient.getObject({
          bucket: config.bucket,
          key: objKey,
        });

        if (result) {
          results.push(JSON.parse(result.body));
        }
      }

      return results;
    },

    async del(relation, key) {
      const objKey = objectKey(config, relation, key);

      // Delete from blob storage
      await blobClient.deleteObject({
        bucket: config.bucket,
        key: objKey,
      });

      // Remove from index
      await indexStorage.del(indexRelation(relation), key);
    },

    async delMany(relation, criteria) {
      // Find matching entries via index
      const matches = await indexStorage.find(indexRelation(relation), criteria);
      if (matches.length === 0) return 0;

      let count = 0;
      for (const entry of matches) {
        const objKey = entry.objectKey as string;
        const entryKey = entry.entryKey as string;

        await blobClient.deleteObject({
          bucket: config.bucket,
          key: objKey,
        });

        await indexStorage.del(indexRelation(relation), entryKey);
        count++;
      }

      return count;
    },

    async getMeta(relation, key) {
      // Delegate to index storage
      const indexEntry = await indexStorage.get(indexRelation(relation), key);
      if (!indexEntry || !indexEntry._lastWrittenAt) return null;
      return { lastWrittenAt: indexEntry._lastWrittenAt as string };
    },
  };

  return storage;
}

/**
 * Get a presigned URL for a stored object.
 * Useful for concepts that serve content (e.g., media, documents).
 */
export async function getPresignedUrl(
  blobClient: BlobClient,
  config: BlobStorageConfig,
  relation: string,
  key: string,
): Promise<string | null> {
  if (!blobClient.getPresignedUrl) return null;

  const objKey = objectKey(config, relation, key);
  const ttl = config.presignedUrlTtl ?? 3600;

  return blobClient.getPresignedUrl({
    bucket: config.bucket,
    key: objKey,
    expiresIn: ttl,
  });
}
