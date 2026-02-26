// ============================================================
// LiteQuery Tests
//
// Validates the LiteQueryProtocol, LiteQueryAdapter with
// caching, snapshot format, and lookup support.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createInMemoryStorage,
} from '../kernel/src/index.js';
import { LiteQueryAdapter, createStorageLiteProtocol } from '../handlers/ts/framework/lite-query-adapter.js';
import type {
  LiteQueryProtocol,
  ConceptStateSnapshot,
} from '../kernel/src/types.js';

// ============================================================
// Lite Query Protocol + Adapter with Caching
// ============================================================

describe('LiteQueryProtocol + Adapter', () => {
  it('LiteQueryAdapter resolves queries via snapshot', async () => {
    const storage = createInMemoryStorage();
    await storage.put('entries', 'u-1', { user: 'u-1', name: 'Alice' });
    await storage.put('entries', 'u-2', { user: 'u-2', name: 'Bob' });

    const protocol = createStorageLiteProtocol(storage, ['entries']);
    const adapter = new LiteQueryAdapter(protocol, 5000);

    const results = await adapter.resolve('entries');
    expect(results).toHaveLength(2);
    expect(results.find(r => r.user === 'u-1')).toBeDefined();
    expect(results.find(r => r.user === 'u-2')).toBeDefined();
  });

  it('LiteQueryAdapter resolves with filter args', async () => {
    const storage = createInMemoryStorage();
    await storage.put('entries', 'u-1', { user: 'u-1', name: 'Alice' });
    await storage.put('entries', 'u-2', { user: 'u-2', name: 'Bob' });

    const protocol = createStorageLiteProtocol(storage, ['entries']);
    const adapter = new LiteQueryAdapter(protocol, 5000);

    const results = await adapter.resolve('entries', { user: 'u-1' });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Alice');
  });

  it('LiteQueryAdapter caches snapshots within TTL', async () => {
    let snapshotCallCount = 0;
    const mockProtocol: LiteQueryProtocol = {
      async snapshot() {
        snapshotCallCount++;
        return {
          asOf: new Date().toISOString(),
          relations: {
            entries: [{ user: 'u-1', name: 'Alice' }],
          },
        };
      },
    };

    const adapter = new LiteQueryAdapter(mockProtocol, 10000); // 10s TTL

    // First call fetches
    await adapter.resolve('entries');
    expect(snapshotCallCount).toBe(1);

    // Second call hits cache
    await adapter.resolve('entries');
    expect(snapshotCallCount).toBe(1);

    // Cache is still valid
    expect(adapter.getCachedSnapshot()).not.toBeNull();
  });

  it('LiteQueryAdapter invalidates cache on explicit invalidation', async () => {
    let snapshotCallCount = 0;
    const mockProtocol: LiteQueryProtocol = {
      async snapshot() {
        snapshotCallCount++;
        return {
          asOf: new Date().toISOString(),
          relations: {
            entries: [{ user: 'u-1' }],
          },
        };
      },
    };

    const adapter = new LiteQueryAdapter(mockProtocol, 10000);

    await adapter.resolve('entries');
    expect(snapshotCallCount).toBe(1);

    // Invalidate (simulates action completion on the concept)
    adapter.invalidate();
    expect(adapter.getCachedSnapshot()).toBeNull();

    // Next call fetches fresh
    await adapter.resolve('entries');
    expect(snapshotCallCount).toBe(2);
  });

  it('LiteQueryAdapter uses lookup for single-key queries', async () => {
    let lookupCalled = false;
    const mockProtocol: LiteQueryProtocol = {
      async snapshot() {
        return { asOf: '', relations: {} };
      },
      async lookup(relation, key) {
        lookupCalled = true;
        return { user: key, name: 'Found' };
      },
    };

    const adapter = new LiteQueryAdapter(mockProtocol, 5000);
    const results = await adapter.resolve('entries', { user: 'u-1' });

    expect(lookupCalled).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Found');
  });

  it('ConceptStateSnapshot has correct format', async () => {
    const storage = createInMemoryStorage();
    await storage.put('entries', 'u-1', { user: 'u-1', hash: 'abc' });
    await storage.put('entries', 'u-2', { user: 'u-2', hash: 'def' });

    const protocol = createStorageLiteProtocol(storage, ['entries']);
    const snapshot = await protocol.snapshot();

    expect(snapshot.asOf).toBeDefined();
    expect(new Date(snapshot.asOf).toISOString()).toBe(snapshot.asOf);
    expect(snapshot.relations).toBeDefined();
    expect(snapshot.relations.entries).toHaveLength(2);
    expect(snapshot.relations.entries[0]).toHaveProperty('user');
    expect(snapshot.relations.entries[0]).toHaveProperty('hash');
  });

  it('createStorageLiteProtocol supports lookup', async () => {
    const storage = createInMemoryStorage();
    await storage.put('entries', 'u-1', { user: 'u-1', name: 'Alice' });

    const protocol = createStorageLiteProtocol(storage, ['entries']);
    const result = await protocol.lookup!('entries', 'u-1');

    expect(result).not.toBeNull();
    expect(result!.name).toBe('Alice');
  });
});
