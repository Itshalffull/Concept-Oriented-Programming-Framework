// ============================================================
// Edge Storage Adapter Tests
//
// Tests for Cloudflare KV, Cloudflare Durable Objects, and
// Vercel KV storage adapters using mock backends.
// Each adapter is tested against the full ConceptStorage contract.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createCloudflareKVStorage } from '../implementations/typescript/storage/cloudflare-kv.js';
import { createDurableObjectStorage } from '../implementations/typescript/storage/cloudflare-do.js';
import { createVercelKVStorage } from '../implementations/typescript/storage/vercel-kv.js';
import type { ConceptStorage, ConflictResolution } from '../kernel/src/types.js';

// ============================================================
// Mock Cloudflare KV Namespace
// ============================================================

function createMockKVNamespace() {
  const store = new Map<string, { value: string; metadata?: Record<string, string> }>();

  return {
    store,
    async get(key: string, _options?: { type?: string }): Promise<string | null> {
      const entry = store.get(key);
      return entry ? entry.value : null;
    },
    async getWithMetadata<M = unknown>(
      key: string,
      _options?: { type?: string },
    ): Promise<{ value: string | null; metadata: M | null }> {
      const entry = store.get(key);
      if (!entry) return { value: null, metadata: null };
      return { value: entry.value, metadata: (entry.metadata ?? null) as M };
    },
    async put(
      key: string,
      value: string,
      options?: { metadata?: Record<string, string> },
    ): Promise<void> {
      store.set(key, { value, metadata: options?.metadata });
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
      keys: { name: string; metadata?: Record<string, string> }[];
      list_complete: boolean;
      cursor?: string;
    }> {
      const prefix = options?.prefix ?? '';
      const keys: { name: string; metadata?: Record<string, string> }[] = [];
      for (const [name, entry] of store.entries()) {
        if (name.startsWith(prefix)) {
          keys.push({ name, metadata: entry.metadata });
        }
      }
      return { keys, list_complete: true };
    },
  };
}

// ============================================================
// Mock Cloudflare Durable Object Storage
// ============================================================

function createMockDOStorage() {
  const store = new Map<string, unknown>();

  const doStorage = {
    async get<T = unknown>(keyOrKeys: string | string[]): Promise<T | Map<string, T> | undefined> {
      if (Array.isArray(keyOrKeys)) {
        const result = new Map<string, T>();
        for (const k of keyOrKeys) {
          const val = store.get(k);
          if (val !== undefined) result.set(k, val as T);
        }
        return result as Map<string, T>;
      }
      return store.get(keyOrKeys) as T | undefined;
    },
    async put<T>(keyOrEntries: string | Record<string, T>, value?: T): Promise<void> {
      if (typeof keyOrEntries === 'string') {
        store.set(keyOrEntries, value);
      } else {
        for (const [k, v] of Object.entries(keyOrEntries)) {
          store.set(k, v);
        }
      }
    },
    async delete(keyOrKeys: string | string[]): Promise<boolean | number> {
      if (Array.isArray(keyOrKeys)) {
        let count = 0;
        for (const k of keyOrKeys) {
          if (store.has(k)) { store.delete(k); count++; }
        }
        return count;
      }
      const had = store.has(keyOrKeys);
      store.delete(keyOrKeys);
      return had;
    },
    async list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>> {
      const prefix = options?.prefix ?? '';
      const result = new Map<string, T>();
      for (const [k, v] of store.entries()) {
        if (k.startsWith(prefix)) {
          result.set(k, v as T);
        }
      }
      return result;
    },
    async transaction<T>(closure: (txn: any) => Promise<T>): Promise<T> {
      // Simple mock: no real transaction isolation
      return closure(doStorage);
    },
  };

  return doStorage;
}

// ============================================================
// Mock Vercel KV Client
// ============================================================

function createMockVercelKV() {
  const store = new Map<string, unknown>();

  return {
    store,
    async get<T = unknown>(key: string): Promise<T | null> {
      const val = store.get(key);
      return val !== undefined ? val as T : null;
    },
    async set(key: string, value: unknown): Promise<string> {
      store.set(key, value);
      return 'OK';
    },
    async del(...keys: string[]): Promise<number> {
      let count = 0;
      for (const k of keys) {
        if (store.has(k)) { store.delete(k); count++; }
      }
      return count;
    },
    async scan(cursor: number, _options?: { match?: string; count?: number }): Promise<[string, string[]]> {
      return ['0', Array.from(store.keys())];
    },
    async keys(pattern: string): Promise<string[]> {
      const prefix = pattern.replace('*', '');
      return Array.from(store.keys()).filter(k => k.startsWith(prefix));
    },
  };
}

// ============================================================
// Shared ConceptStorage Contract Tests
// ============================================================

function runStorageContractTests(name: string, createStorage: () => ConceptStorage) {
  describe(`${name} — ConceptStorage Contract`, () => {
    let storage: ConceptStorage;

    beforeEach(() => {
      storage = createStorage();
    });

    it('put and get a value', async () => {
      await storage.put('users', 'alice', { name: 'Alice', age: 30 });
      const result = await storage.get('users', 'alice');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Alice');
      expect(result!.age).toBe(30);
    });

    it('get returns null for missing key', async () => {
      const result = await storage.get('users', 'nonexistent');
      expect(result).toBeNull();
    });

    it('put overwrites existing value', async () => {
      await storage.put('users', 'alice', { name: 'Alice', age: 30 });
      await storage.put('users', 'alice', { name: 'Alice', age: 31 });
      const result = await storage.get('users', 'alice');
      expect(result!.age).toBe(31);
    });

    it('del removes a value', async () => {
      await storage.put('users', 'alice', { name: 'Alice' });
      await storage.del('users', 'alice');
      const result = await storage.get('users', 'alice');
      expect(result).toBeNull();
    });

    it('find returns all entries in a relation', async () => {
      await storage.put('users', 'alice', { name: 'Alice', role: 'admin' });
      await storage.put('users', 'bob', { name: 'Bob', role: 'user' });
      const results = await storage.find('users');
      expect(results).toHaveLength(2);
    });

    it('find with criteria filters results', async () => {
      await storage.put('users', 'alice', { name: 'Alice', role: 'admin' });
      await storage.put('users', 'bob', { name: 'Bob', role: 'user' });
      const admins = await storage.find('users', { role: 'admin' });
      expect(admins).toHaveLength(1);
      expect(admins[0].name).toBe('Alice');
    });

    it('find returns empty array for empty relation', async () => {
      const results = await storage.find('empty');
      expect(results).toEqual([]);
    });

    it('delMany removes matching entries', async () => {
      await storage.put('users', 'alice', { name: 'Alice', role: 'admin' });
      await storage.put('users', 'bob', { name: 'Bob', role: 'user' });
      await storage.put('users', 'charlie', { name: 'Charlie', role: 'user' });
      const count = await storage.delMany('users', { role: 'user' });
      expect(count).toBe(2);
      const remaining = await storage.find('users');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe('Alice');
    });

    it('getMeta returns metadata with lastWrittenAt', async () => {
      await storage.put('users', 'alice', { name: 'Alice' });
      if (storage.getMeta) {
        const meta = await storage.getMeta('users', 'alice');
        expect(meta).not.toBeNull();
        expect(meta!.lastWrittenAt).toBeDefined();
        expect(typeof meta!.lastWrittenAt).toBe('string');
      }
    });

    it('getMeta returns null for missing key', async () => {
      if (storage.getMeta) {
        const meta = await storage.getMeta('users', 'nonexistent');
        expect(meta).toBeNull();
      }
    });

    it('isolates data across relations', async () => {
      await storage.put('users', 'key1', { type: 'user' });
      await storage.put('posts', 'key1', { type: 'post' });
      const users = await storage.find('users');
      const posts = await storage.find('posts');
      expect(users).toHaveLength(1);
      expect(users[0].type).toBe('user');
      expect(posts).toHaveLength(1);
      expect(posts[0].type).toBe('post');
    });
  });
}

// ============================================================
// Conflict Detection Tests
// ============================================================

function runConflictTests(name: string, createStorage: () => ConceptStorage) {
  describe(`${name} — Conflict Detection`, () => {
    it('onConflict keep-existing prevents overwrite', async () => {
      const storage = createStorage();
      storage.onConflict = () => ({ action: 'keep-existing' });

      await storage.put('data', 'key1', { value: 'original' });
      await storage.put('data', 'key1', { value: 'overwrite' });

      const result = await storage.get('data', 'key1');
      expect(result!.value).toBe('original');
    });

    it('onConflict accept-incoming allows overwrite', async () => {
      const storage = createStorage();
      storage.onConflict = () => ({ action: 'accept-incoming' });

      await storage.put('data', 'key1', { value: 'original' });
      await storage.put('data', 'key1', { value: 'overwrite' });

      const result = await storage.get('data', 'key1');
      expect(result!.value).toBe('overwrite');
    });

    it('onConflict merge stores merged value', async () => {
      const storage = createStorage();
      storage.onConflict = (info) => ({
        action: 'merge',
        merged: { ...info.existing.fields, ...info.incoming.fields, merged: true },
      });

      await storage.put('data', 'key1', { a: 1 });
      await storage.put('data', 'key1', { b: 2 });

      const result = await storage.get('data', 'key1');
      expect(result!.a).toBe(1);
      expect(result!.b).toBe(2);
      expect(result!.merged).toBe(true);
    });

    it('onConflict receives correct conflict info', async () => {
      const storage = createStorage();
      let capturedInfo: any = null;
      storage.onConflict = (info) => {
        capturedInfo = info;
        return { action: 'accept-incoming' };
      };

      await storage.put('rel', 'k', { v: 'first' });
      await storage.put('rel', 'k', { v: 'second' });

      expect(capturedInfo).not.toBeNull();
      expect(capturedInfo.relation).toBe('rel');
      expect(capturedInfo.key).toBe('k');
      expect(capturedInfo.existing.fields.v).toBe('first');
      expect(capturedInfo.incoming.fields.v).toBe('second');
    });
  });
}

// ============================================================
// Run all adapter test suites
// ============================================================

runStorageContractTests('Cloudflare KV', () => createCloudflareKVStorage(createMockKVNamespace()));
runConflictTests('Cloudflare KV', () => createCloudflareKVStorage(createMockKVNamespace()));

runStorageContractTests('Durable Objects', () => createDurableObjectStorage(createMockDOStorage()));
runConflictTests('Durable Objects', () => createDurableObjectStorage(createMockDOStorage()));

runStorageContractTests('Vercel KV', () => createVercelKVStorage(createMockVercelKV()));
runConflictTests('Vercel KV', () => createVercelKVStorage(createMockVercelKV()));
