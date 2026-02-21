// Conduit Storage Backends — Factory and Backend Validation
// Tests the storage factory and validates all backend configs exist.

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { createStorageForBackend } from '../examples/conduit/storage/factory.js';
import type { AppConfig } from '../examples/conduit/server/config.js';

function mkConfig(backend: AppConfig['storageBackend']): AppConfig {
  return {
    port: 3000,
    jwtSecret: 'test',
    storageBackend: backend,
    transportMode: 'in-process',
    redisUrl: 'redis://localhost:6379',
    logLevel: 'info',
  };
}

describe('Conduit Storage — Factory', () => {
  const backends: AppConfig['storageBackend'][] = [
    'memory', 'redis', 'dynamodb', 'firestore',
    'cloudflare-kv', 'cloudflare-do', 'vercel-kv',
  ];

  for (const backend of backends) {
    it(`creates storage for ${backend} backend`, () => {
      const storage = createStorageForBackend(mkConfig(backend));
      expect(storage).toBeDefined();
      expect(storage.put).toBeDefined();
      expect(storage.get).toBeDefined();
      expect(storage.find).toBeDefined();
      expect(storage.del).toBeDefined();
    });
  }

  it('falls back to memory for unknown backend', () => {
    const storage = createStorageForBackend(mkConfig('unknown-backend' as any));
    expect(storage).toBeDefined();
  });

  it('in-memory storage works end-to-end', async () => {
    const storage = createStorageForBackend(mkConfig('memory'));
    await storage.put('test', 'key1', { value: 42 });
    const result = await storage.get('test', 'key1');
    expect(result).toBeDefined();
    expect((result as Record<string, unknown>).value).toBe(42);
  });
});

describe('Conduit Storage — File Structure', () => {
  const storageDir = resolve(__dirname, '..', 'examples', 'conduit', 'storage');

  it('factory.ts exists', () => {
    expect(existsSync(resolve(storageDir, 'factory.ts'))).toBe(true);
  });
});
