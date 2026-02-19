// ============================================================
// Serverless Connection Pooling
//
// Lambda/GCF reuse execution contexts between invocations.
// Storage adapter connections (DynamoDB clients, Firestore
// instances, Redis connections) should be initialized outside
// the handler and reused across warm invocations.
//
// This module provides lazy singleton factories for each
// storage backend, ensuring connections are created once per
// execution context and reused across warm invocations.
// ============================================================

import type { ConceptStorage } from '../../kernel/src/types.js';
import type { DynamoDBDocumentClient, DynamoDBStorageConfig } from '../storage/dynamodb-storage.js';
import type { FirestoreClient, FirestoreStorageConfig } from '../storage/firestore-storage.js';
import type { RedisClient, RedisStorageConfig } from '../storage/redis-storage.js';
import { createDynamoDBStorage } from '../storage/dynamodb-storage.js';
import { createFirestoreStorage } from '../storage/firestore-storage.js';
import { createRedisStorage } from '../storage/redis-storage.js';

// --- Lazy Singleton Cache ---

const storageCache = new Map<string, ConceptStorage>();

function cacheKey(type: string, config: Record<string, unknown>): string {
  return `${type}:${JSON.stringify(config)}`;
}

/**
 * Get or create a DynamoDB storage adapter.
 * Reuses the same instance across warm invocations in the same
 * execution context (Lambda container reuse).
 */
export function getDynamoDBStorage(
  client: DynamoDBDocumentClient,
  config: DynamoDBStorageConfig,
): ConceptStorage {
  const key = cacheKey('dynamodb', config as unknown as Record<string, unknown>);
  let storage = storageCache.get(key);
  if (!storage) {
    storage = createDynamoDBStorage(client, config);
    storageCache.set(key, storage);
  }
  return storage;
}

/**
 * Get or create a Firestore storage adapter.
 * Reuses the same instance across warm invocations.
 */
export function getFirestoreStorage(
  client: FirestoreClient,
  config: FirestoreStorageConfig,
): ConceptStorage {
  const key = cacheKey('firestore', config as unknown as Record<string, unknown>);
  let storage = storageCache.get(key);
  if (!storage) {
    storage = createFirestoreStorage(client, config);
    storageCache.set(key, storage);
  }
  return storage;
}

/**
 * Get or create a Redis storage adapter.
 * For serverless, prefer Upstash (HTTP-based, no persistent connections).
 */
export function getRedisStorage(
  client: RedisClient,
  config: RedisStorageConfig,
): ConceptStorage {
  const key = cacheKey('redis', config as unknown as Record<string, unknown>);
  let storage = storageCache.get(key);
  if (!storage) {
    storage = createRedisStorage(client, config);
    storageCache.set(key, storage);
  }
  return storage;
}

/**
 * Clear all cached storage instances.
 * Used primarily in tests.
 */
export function clearStorageCache(): void {
  storageCache.clear();
}

/**
 * Get a cached storage instance by type and config key.
 * Returns undefined if not cached.
 */
export function getCachedStorage(type: string, config: Record<string, unknown>): ConceptStorage | undefined {
  return storageCache.get(cacheKey(type, config));
}
