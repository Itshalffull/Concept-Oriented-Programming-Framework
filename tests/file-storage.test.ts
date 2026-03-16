// File Storage Adapter Tests
// Validates JSONL-based persistent local storage and storage factory.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createFileStorage, compactAll } from '../runtime/adapters/file-storage.js';
import { createStorageFactory, resolveStorageConfig } from '../runtime/adapters/storage-factory.js';
import type { ConceptStorage } from '../runtime/types.js';

let testDir: string;
let storage: ConceptStorage;

function freshDir(): string {
  const dir = join(tmpdir(), `clef-file-storage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

beforeEach(() => {
  testDir = freshDir();
  storage = createFileStorage({ dataDir: testDir });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

// ── Basic CRUD ───────────────────────────────────────────────────────

describe('file storage: basic CRUD', () => {
  it('put and get', async () => {
    await storage.put('users', 'u1', { name: 'Alice', age: 30 });
    const result = await storage.get('users', 'u1');
    expect(result).toEqual(expect.objectContaining({ name: 'Alice', age: 30 }));
  });

  it('get returns null for missing key', async () => {
    const result = await storage.get('users', 'missing');
    expect(result).toBeNull();
  });

  it('put overwrites existing entry', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.put('users', 'u1', { name: 'Bob' });
    const result = await storage.get('users', 'u1');
    expect(result).toEqual(expect.objectContaining({ name: 'Bob' }));
  });

  it('del removes an entry', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.del('users', 'u1');
    const result = await storage.get('users', 'u1');
    expect(result).toBeNull();
  });

  it('delMany removes matching entries', async () => {
    await storage.put('users', 'u1', { role: 'admin' });
    await storage.put('users', 'u2', { role: 'user' });
    await storage.put('users', 'u3', { role: 'admin' });
    const count = await storage.delMany('users', { role: 'admin' });
    expect(count).toBe(2);
    expect(await storage.get('users', 'u1')).toBeNull();
    expect(await storage.get('users', 'u2')).not.toBeNull();
    expect(await storage.get('users', 'u3')).toBeNull();
  });

  it('find returns all entries when no criteria', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.put('users', 'u2', { name: 'Bob' });
    const results = await storage.find('users');
    expect(results).toHaveLength(2);
  });

  it('find filters by criteria', async () => {
    await storage.put('users', 'u1', { role: 'admin', name: 'Alice' });
    await storage.put('users', 'u2', { role: 'user', name: 'Bob' });
    await storage.put('users', 'u3', { role: 'admin', name: 'Carol' });
    const results = await storage.find('users', { role: 'admin' });
    expect(results).toHaveLength(2);
    expect(results.map(r => r['name'])).toContain('Alice');
    expect(results.map(r => r['name'])).toContain('Carol');
  });

  it('find returns _key field', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    const results = await storage.find('users');
    expect(results[0]['_key']).toBe('u1');
  });
});

// ── Metadata ─────────────────────────────────────────────────────────

describe('file storage: metadata', () => {
  it('getMeta returns lastWrittenAt timestamp', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    const meta = await storage.getMeta!('users', 'u1');
    expect(meta).not.toBeNull();
    expect(meta!.lastWrittenAt).toBeTruthy();
    // Should be a valid ISO string
    expect(new Date(meta!.lastWrittenAt).toISOString()).toBe(meta!.lastWrittenAt);
  });

  it('getMeta returns null for missing key', async () => {
    const meta = await storage.getMeta!('users', 'missing');
    expect(meta).toBeNull();
  });

  it('getMeta updates on overwrite', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    const meta1 = await storage.getMeta!('users', 'u1');

    // Small delay to ensure different timestamp
    await new Promise(r => setTimeout(r, 5));

    await storage.put('users', 'u1', { name: 'Bob' });
    const meta2 = await storage.getMeta!('users', 'u1');

    expect(meta2!.lastWrittenAt >= meta1!.lastWrittenAt).toBe(true);
  });
});

// ── Persistence ──────────────────────────────────────────────────────

describe('file storage: persistence across instances', () => {
  it('data survives creating a new storage instance', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.put('users', 'u2', { name: 'Bob' });

    // Create a fresh instance pointing at the same directory
    const storage2 = createFileStorage({ dataDir: testDir });
    const result = await storage2.get('users', 'u1');
    expect(result).toEqual(expect.objectContaining({ name: 'Alice' }));

    const all = await storage2.find('users');
    expect(all).toHaveLength(2);
  });

  it('deletes persist across instances', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.del('users', 'u1');

    const storage2 = createFileStorage({ dataDir: testDir });
    expect(await storage2.get('users', 'u1')).toBeNull();
  });

  it('overwrites persist across instances', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.put('users', 'u1', { name: 'Bob' });

    const storage2 = createFileStorage({ dataDir: testDir });
    const result = await storage2.get('users', 'u1');
    expect(result).toEqual(expect.objectContaining({ name: 'Bob' }));
  });
});

// ── Multiple Relations ───────────────────────────────────────────────

describe('file storage: multiple relations', () => {
  it('relations are independent', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.put('posts', 'p1', { title: 'Hello' });

    expect(await storage.get('users', 'u1')).toEqual(expect.objectContaining({ name: 'Alice' }));
    expect(await storage.get('posts', 'p1')).toEqual(expect.objectContaining({ title: 'Hello' }));
    expect(await storage.get('users', 'p1')).toBeNull();
    expect(await storage.get('posts', 'u1')).toBeNull();
  });

  it('each relation produces a separate JSONL file', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.put('posts', 'p1', { title: 'Hello' });

    expect(existsSync(join(testDir, 'users.jsonl'))).toBe(true);
    expect(existsSync(join(testDir, 'posts.jsonl'))).toBe(true);
  });
});

// ── Namespace ────────────────────────────────────────────────────────

describe('file storage: namespace', () => {
  it('namespace prefixes file names', async () => {
    const nsStorage = createFileStorage({ dataDir: testDir, namespace: 'MyApp' });
    await nsStorage.put('users', 'u1', { name: 'Alice' });

    expect(existsSync(join(testDir, 'MyApp--users.jsonl'))).toBe(true);
  });

  it('namespaced storages are isolated', async () => {
    const s1 = createFileStorage({ dataDir: testDir, namespace: 'App1' });
    const s2 = createFileStorage({ dataDir: testDir, namespace: 'App2' });

    await s1.put('users', 'u1', { name: 'Alice' });
    await s2.put('users', 'u1', { name: 'Bob' });

    expect(await s1.get('users', 'u1')).toEqual(expect.objectContaining({ name: 'Alice' }));
    expect(await s2.get('users', 'u1')).toEqual(expect.objectContaining({ name: 'Bob' }));
  });
});

// ── Compaction ────────────────────────────────────────────────────────

describe('file storage: compaction', () => {
  it('compactAll rewrites files to remove tombstones', async () => {
    // Disable auto-compaction by using a high threshold
    const noAutoCompact = createFileStorage({ dataDir: testDir, compactionThreshold: Infinity });

    for (let i = 0; i < 10; i++) {
      await noAutoCompact.put('items', `k${i}`, { n: i });
    }
    for (let i = 0; i < 8; i++) {
      await noAutoCompact.del('items', `k${i}`);
    }

    const filePath = join(testDir, 'items.jsonl');
    const beforeLines = readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
    expect(beforeLines.length).toBe(18); // 10 puts + 8 dels

    const results = compactAll(testDir);
    expect(results).toHaveLength(1);
    expect(results[0].before).toBe(18);
    expect(results[0].after).toBe(2); // Only k8 and k9 survive

    const afterLines = readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
    expect(afterLines.length).toBe(2);

    // Data integrity after compaction
    const storage2 = createFileStorage({ dataDir: testDir });
    expect(await storage2.get('items', 'k8')).toEqual(expect.objectContaining({ n: 8 }));
    expect(await storage2.get('items', 'k0')).toBeNull();
  });
});

// ── JSONL Format ─────────────────────────────────────────────────────

describe('file storage: JSONL format', () => {
  it('each entry is a valid JSON line', async () => {
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.put('users', 'u2', { name: 'Bob' });

    const content = readFileSync(join(testDir, 'users.jsonl'), 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    expect(lines).toHaveLength(2);

    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed._op).toBe('put');
      expect(parsed._key).toBeTruthy();
      expect(parsed._ts).toBeTruthy();
    }
  });

  it('del entries have _op: del', async () => {
    // Disable auto-compaction so del entry stays in the log
    const noAutoCompact = createFileStorage({ dataDir: testDir, compactionThreshold: Infinity });
    await noAutoCompact.put('deltest', 'u1', { name: 'Alice' });
    await noAutoCompact.del('deltest', 'u1');

    const content = readFileSync(join(testDir, 'deltest.jsonl'), 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    expect(lines).toHaveLength(2);

    const delEntry = JSON.parse(lines[1]);
    expect(delEntry._op).toBe('del');
    expect(delEntry._key).toBe('u1');
  });

  it('survives malformed lines in the file', async () => {
    // Write some valid data
    await storage.put('users', 'u1', { name: 'Alice' });

    // Manually corrupt the file by appending garbage
    const filePath = join(testDir, 'users.jsonl');
    writeFileSync(filePath, readFileSync(filePath, 'utf-8') + 'not valid json\n', 'utf-8');

    // Append more valid data after the corruption
    writeFileSync(
      filePath,
      readFileSync(filePath, 'utf-8') +
      JSON.stringify({ _op: 'put', _key: 'u2', _ts: new Date().toISOString(), name: 'Bob' }) + '\n',
      'utf-8',
    );

    // New instance should skip the bad line and load both valid entries
    const storage2 = createFileStorage({ dataDir: testDir });
    expect(await storage2.get('users', 'u1')).toEqual(expect.objectContaining({ name: 'Alice' }));
    expect(await storage2.get('users', 'u2')).toEqual(expect.objectContaining({ name: 'Bob' }));
  });
});

// ── Conflict Resolution ──────────────────────────────────────────────

describe('file storage: conflict resolution', () => {
  it('onConflict keep-existing prevents write', async () => {
    storage.onConflict = () => ({ action: 'keep-existing' as const });
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.put('users', 'u1', { name: 'Bob' });
    const result = await storage.get('users', 'u1');
    expect(result).toEqual(expect.objectContaining({ name: 'Alice' }));
  });

  it('onConflict accept-incoming allows write', async () => {
    storage.onConflict = () => ({ action: 'accept-incoming' as const });
    await storage.put('users', 'u1', { name: 'Alice' });
    await storage.put('users', 'u1', { name: 'Bob' });
    const result = await storage.get('users', 'u1');
    expect(result).toEqual(expect.objectContaining({ name: 'Bob' }));
  });

  it('onConflict merge combines values', async () => {
    storage.onConflict = (info) => ({
      action: 'merge' as const,
      merged: { ...info.existing.fields, ...info.incoming.fields, merged: true },
    });
    await storage.put('users', 'u1', { name: 'Alice', age: 30 });
    await storage.put('users', 'u1', { name: 'Bob' });
    const result = await storage.get('users', 'u1');
    expect(result).toEqual(expect.objectContaining({ name: 'Bob', age: 30, merged: true }));
  });
});

// ── Storage Factory ──────────────────────────────────────────────────

describe('storage factory', () => {
  it('resolves to file backend by default with writable dir', () => {
    const resolved = resolveStorageConfig({ projectRoot: testDir });
    expect(resolved.backend).toBe('file');
    expect(resolved.reason).toContain('default');
  });

  it('resolves to memory when ephemeral is true', () => {
    const resolved = resolveStorageConfig({ ephemeral: true });
    expect(resolved.backend).toBe('memory');
  });

  it('explicit backend overrides detection', () => {
    const resolved = resolveStorageConfig({ backend: 'sqlite' });
    expect(resolved.backend).toBe('sqlite');
    expect(resolved.reason).toBe('explicit config');
  });

  it('CLEF_STORAGE env var overrides default', () => {
    const original = process.env['CLEF_STORAGE'];
    process.env['CLEF_STORAGE'] = 'memory';
    try {
      const resolved = resolveStorageConfig({ projectRoot: testDir });
      expect(resolved.backend).toBe('memory');
      expect(resolved.reason).toContain('CLEF_STORAGE');
    } finally {
      if (original === undefined) {
        delete process.env['CLEF_STORAGE'];
      } else {
        process.env['CLEF_STORAGE'] = original;
      }
    }
  });

  it('reads .clef/config.yaml', () => {
    const clefDir = join(testDir, '.clef');
    mkdirSync(clefDir, { recursive: true });
    writeFileSync(join(clefDir, 'config.yaml'), 'storage: sqlite\n', 'utf-8');

    const resolved = resolveStorageConfig({ projectRoot: testDir });
    expect(resolved.backend).toBe('sqlite');
    expect(resolved.reason).toContain('config.yaml');
  });

  it('factory creates file storage instances per concept', async () => {
    const makeStorage = createStorageFactory({ projectRoot: testDir });

    const s1 = makeStorage('urn:clef/FormalProperty');
    const s2 = makeStorage('urn:clef/QualitySignal');

    await s1.put('props', 'p1', { name: 'safety' });
    await s2.put('signals', 's1', { dimension: 'formal' });

    // Each concept has its own namespace
    expect(existsSync(join(testDir, '.clef', 'data', 'FormalProperty--props.jsonl'))).toBe(true);
    expect(existsSync(join(testDir, '.clef', 'data', 'QualitySignal--signals.jsonl'))).toBe(true);

    // Data is isolated
    expect(await s1.get('signals', 's1')).toBeNull();
    expect(await s2.get('props', 'p1')).toBeNull();
  });

  it('factory caches instances — same name returns same storage', () => {
    const makeStorage = createStorageFactory({ projectRoot: testDir });
    const s1 = makeStorage('urn:clef/Foo');
    const s2 = makeStorage('urn:clef/Foo');
    expect(s1).toBe(s2);
  });

  it('factory creates in-memory storage when ephemeral', async () => {
    const makeStorage = createStorageFactory({ ephemeral: true, projectRoot: testDir });
    const s = makeStorage('urn:clef/Test');
    await s.put('items', 'k1', { v: 1 });
    expect(await s.get('items', 'k1')).toEqual(expect.objectContaining({ v: 1 }));

    // No files created
    const dataDir = join(testDir, '.clef', 'data');
    if (existsSync(dataDir)) {
      const { readdirSync } = await import('node:fs');
      const files = readdirSync(dataDir).filter(f => f.endsWith('.jsonl'));
      expect(files).toHaveLength(0);
    }
  });
});
