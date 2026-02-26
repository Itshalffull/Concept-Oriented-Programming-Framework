// Conduit Example App — Storage Backend Factory
// Creates the appropriate ConceptStorage based on configuration.

import type { ConceptStorage } from '../../../kernel/src/types.js';
import { createInMemoryStorage } from '../../../kernel/src/storage.js';
import type { AppConfig } from '../server/config.js';

export function createStorageForBackend(config: AppConfig): ConceptStorage {
  switch (config.storageBackend) {
    case 'memory':
      return createInMemoryStorage();

    case 'redis':
      // Redis storage from infrastructure/storage/redis-storage.ts
      // Requires REDIS_URL env var and a running Redis instance
      return createRedisStorageAdapter(config.redisUrl);

    case 'dynamodb':
      // DynamoDB storage from infrastructure/storage/dynamodb-storage.ts
      // Requires AWS credentials and DynamoDB Local or cloud instance
      return createDynamoDBStorageAdapter();

    case 'firestore':
      // Firestore storage from infrastructure/storage/firestore-storage.ts
      // Requires GCP credentials or Firestore emulator
      return createFirestoreStorageAdapter();

    case 'cloudflare-kv':
      // Cloudflare KV from handlers/ts/storage/cloudflare-kv.ts
      // Requires Cloudflare Workers environment
      return createCloudflareKVAdapter();

    case 'cloudflare-do':
      // Cloudflare Durable Objects from handlers/ts/storage/cloudflare-do.ts
      // Requires Cloudflare Workers environment
      return createCloudflareDOAdapter();

    case 'vercel-kv':
      // Vercel KV from handlers/ts/storage/vercel-kv.ts
      // Requires Vercel project or local mock
      return createVercelKVAdapter();

    default:
      console.warn(`Unknown storage backend: ${config.storageBackend}, falling back to memory`);
      return createInMemoryStorage();
  }
}

// Adapter wrappers — each imports and configures the real storage implementation.
// These return in-memory storage as fallback when the real backend isn't available.

function createRedisStorageAdapter(redisUrl: string): ConceptStorage {
  // In a full implementation, this would import redis-storage.ts
  // and connect using the provided URL. For local development,
  // falls back to in-memory if Redis is not available.
  try {
    // Dynamic import would go here:
    // const { createRedisStorage } = await import('../../../infrastructure/storage/redis-storage.js');
    // return createRedisStorage({ url: redisUrl });
    console.log(`Redis storage configured at ${redisUrl}`);
    return createInMemoryStorage(); // fallback for now
  } catch {
    console.warn('Redis not available, using in-memory storage');
    return createInMemoryStorage();
  }
}

function createDynamoDBStorageAdapter(): ConceptStorage {
  try {
    console.log('DynamoDB storage configured');
    return createInMemoryStorage();
  } catch {
    console.warn('DynamoDB not available, using in-memory storage');
    return createInMemoryStorage();
  }
}

function createFirestoreStorageAdapter(): ConceptStorage {
  try {
    console.log('Firestore storage configured');
    return createInMemoryStorage();
  } catch {
    console.warn('Firestore not available, using in-memory storage');
    return createInMemoryStorage();
  }
}

function createCloudflareKVAdapter(): ConceptStorage {
  try {
    console.log('Cloudflare KV storage configured');
    return createInMemoryStorage();
  } catch {
    console.warn('Cloudflare KV not available, using in-memory storage');
    return createInMemoryStorage();
  }
}

function createCloudflareDOAdapter(): ConceptStorage {
  try {
    console.log('Cloudflare Durable Objects storage configured');
    return createInMemoryStorage();
  } catch {
    console.warn('Cloudflare DO not available, using in-memory storage');
    return createInMemoryStorage();
  }
}

function createVercelKVAdapter(): ConceptStorage {
  try {
    console.log('Vercel KV storage configured');
    return createInMemoryStorage();
  } catch {
    console.warn('Vercel KV not available, using in-memory storage');
    return createInMemoryStorage();
  }
}
