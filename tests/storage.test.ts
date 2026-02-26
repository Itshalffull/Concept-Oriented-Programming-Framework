// ============================================================
// Storage Tests - In-Memory Storage
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage, type ConceptStorage } from '@clef/kernel';

describe('In-Memory Storage', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('puts and gets a record', async () => {
    await storage.put('users', 'u1', { name: 'Alice', email: 'a@b.com' });
    const record = await storage.get('users', 'u1');
    expect(record).toEqual({ name: 'Alice', email: 'a@b.com' });
  });

  it('returns null for missing record', async () => {
    const record = await storage.get('users', 'nonexistent');
    expect(record).toBeNull();
  });

  it('overwrites existing record', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.put('users', 'u1', { name: 'Bob' });
    const record = await storage.get('users', 'u1');
    expect(record).toEqual({ name: 'Bob' });
  });

  it('finds all records in a relation', async () => {
    await storage.put('users', 'u1', { name: 'Alice', role: 'admin' });
    await storage.put('users', 'u2', { name: 'Bob', role: 'user' });
    await storage.put('users', 'u3', { name: 'Charlie', role: 'user' });

    const all = await storage.find('users');
    expect(all).toHaveLength(3);
  });

  it('finds records matching criteria', async () => {
    await storage.put('users', 'u1', { name: 'Alice', role: 'admin' });
    await storage.put('users', 'u2', { name: 'Bob', role: 'user' });
    await storage.put('users', 'u3', { name: 'Charlie', role: 'user' });

    const users = await storage.find('users', { role: 'user' });
    expect(users).toHaveLength(2);
    expect(users.map(u => u.name).sort()).toEqual(['Bob', 'Charlie']);
  });

  it('deletes a record', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.del('users', 'u1');
    const record = await storage.get('users', 'u1');
    expect(record).toBeNull();
  });

  it('deletes records matching criteria', async () => {
    await storage.put('users', 'u1', { name: 'Alice', role: 'admin' });
    await storage.put('users', 'u2', { name: 'Bob', role: 'user' });
    await storage.put('users', 'u3', { name: 'Charlie', role: 'user' });

    const count = await storage.delMany('users', { role: 'user' });
    expect(count).toBe(2);

    const remaining = await storage.find('users');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('Alice');
  });

  it('returns empty array for empty relation', async () => {
    const records = await storage.find('empty');
    expect(records).toEqual([]);
  });

  it('isolates relations from each other', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.put('posts', 'p1', { title: 'Hello' });

    const users = await storage.find('users');
    const posts = await storage.find('posts');
    expect(users).toHaveLength(1);
    expect(posts).toHaveLength(1);
    expect(users[0].name).toBe('Alice');
    expect(posts[0].title).toBe('Hello');
  });
});
