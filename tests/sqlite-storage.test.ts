import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createSQLiteStorage } from '../runtime/adapters/sqlite-storage.js';
import { createStorageFactory } from '../runtime/adapters/storage-factory.js';
import type { ConceptStorage } from '../runtime/types.js';

let testDir: string;
let dbPath: string;
let storage: ConceptStorage;

function freshDir(): string {
  const dir = join(tmpdir(), `clef-sqlite-storage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

beforeEach(() => {
  testDir = freshDir();
  dbPath = join(testDir, 'storage.db');
  storage = createSQLiteStorage({ dbPath, namespace: 'TestConcept' });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe('sqlite storage: basic CRUD', () => {
  it('put and get', async () => {
    await storage.put('users', 'u1', { name: 'Alice', age: 30 });
    const result = await storage.get('users', 'u1');
    expect(result).toEqual(expect.objectContaining({ name: 'Alice', age: 30 }));
  });

  it('find filters by criteria', async () => {
    await storage.put('users', 'u1', { role: 'admin', name: 'Alice' });
    await storage.put('users', 'u2', { role: 'user', name: 'Bob' });
    await storage.put('users', 'u3', { role: 'admin', name: 'Carol' });

    const results = await storage.find('users', { role: 'admin' });
    expect(results).toHaveLength(2);
    expect(results.map((row) => row.name).sort()).toEqual(['Alice', 'Carol']);
  });

  it('delMany removes matching entries', async () => {
    await storage.put('users', 'u1', { role: 'admin' });
    await storage.put('users', 'u2', { role: 'user' });
    await storage.put('users', 'u3', { role: 'admin' });

    const deleted = await storage.delMany('users', { role: 'admin' });
    expect(deleted).toBe(2);
    expect(await storage.get('users', 'u1')).toBeNull();
    expect(await storage.get('users', 'u2')).not.toBeNull();
    expect(await storage.get('users', 'u3')).toBeNull();
  });
});

describe('sqlite storage: persistence and isolation', () => {
  it('persists across instances', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });

    const storage2 = createSQLiteStorage({ dbPath, namespace: 'TestConcept' });
    expect(await storage2.get('users', 'u1')).toEqual(expect.objectContaining({ name: 'Alice' }));
  });

  it('isolates namespaces in the same database', async () => {
    const alpha = createSQLiteStorage({ dbPath, namespace: 'Alpha' });
    const beta = createSQLiteStorage({ dbPath, namespace: 'Beta' });

    await alpha.put('users', 'u1', { name: 'Alice' });
    await beta.put('users', 'u1', { name: 'Bob' });

    expect(await alpha.get('users', 'u1')).toEqual(expect.objectContaining({ name: 'Alice' }));
    expect(await beta.get('users', 'u1')).toEqual(expect.objectContaining({ name: 'Bob' }));
  });
});

describe('sqlite storage: secondary indexes', () => {
  it('ensureIndex is idempotent and indexed finds still work', async () => {
    storage.ensureIndex!('membership', 'schema');
    storage.ensureIndex!('membership', 'schema');

    await storage.put('membership', 'a::Article', { entity_id: 'a', schema: 'Article' });
    await storage.put('membership', 'b::Concept', { entity_id: 'b', schema: 'Concept' });
    await storage.put('membership', 'c::Article', { entity_id: 'c', schema: 'Article' });

    const results = await storage.find('membership', { schema: 'Article' });
    expect(results).toHaveLength(2);
    expect(results.map((row) => row.entity_id).sort()).toEqual(['a', 'c']);
  });

  it('supports sort, limit, and offset with indexed criteria', async () => {
    storage.ensureIndex!('items', 'category');
    await storage.put('items', '1', { name: 'a', category: 'fruit', price: 3 });
    await storage.put('items', '2', { name: 'b', category: 'fruit', price: 1 });
    await storage.put('items', '3', { name: 'c', category: 'fruit', price: 2 });

    const results = await storage.find(
      'items',
      { category: 'fruit' },
      { sort: { field: 'price', order: 'asc' }, offset: 1, limit: 1 },
    );

    expect(results).toHaveLength(1);
    expect(results[0].price).toBe(2);
  });
});

describe('storage factory: sqlite backend', () => {
  it('creates sqlite-backed isolated concept storages', async () => {
    const makeStorage = createStorageFactory({ backend: 'sqlite', dataDir: dbPath, projectRoot: testDir });
    const alpha = makeStorage('urn:clef/Alpha');
    const beta = makeStorage('urn:clef/Beta');

    await alpha.put('items', 'a1', { label: 'alpha' });
    await beta.put('items', 'b1', { label: 'beta' });

    expect(await alpha.get('items', 'a1')).toEqual(expect.objectContaining({ label: 'alpha' }));
    expect(await beta.get('items', 'b1')).toEqual(expect.objectContaining({ label: 'beta' }));
    expect(await alpha.get('items', 'b1')).toBeNull();
  });
});
