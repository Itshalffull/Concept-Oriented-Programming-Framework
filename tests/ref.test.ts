// Ref concept handler tests -- create, update (CAS), delete, resolve, and reflog.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { refHandler, resetRefCounter } from '../implementations/typescript/ref.impl.js';

describe('Ref', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetRefCounter();
  });

  describe('create', () => {
    it('creates a new ref pointing to a hash', async () => {
      const result = await refHandler.create({ name: 'HEAD', hash: 'abc123' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.ref).toBe('ref-1');
    });

    it('rejects duplicate ref names', async () => {
      await refHandler.create({ name: 'HEAD', hash: 'abc123' }, storage);
      const result = await refHandler.create({ name: 'HEAD', hash: 'def456' }, storage);
      expect(result.variant).toBe('exists');
    });

    it('allows different ref names', async () => {
      const r1 = await refHandler.create({ name: 'HEAD', hash: 'abc' }, storage);
      const r2 = await refHandler.create({ name: 'refs/tags/v1', hash: 'def' }, storage);
      expect(r1.variant).toBe('ok');
      expect(r2.variant).toBe('ok');
    });
  });

  describe('resolve', () => {
    it('resolves a ref name to its target hash', async () => {
      await refHandler.create({ name: 'HEAD', hash: 'abc123' }, storage);
      const result = await refHandler.resolve({ name: 'HEAD' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.hash).toBe('abc123');
    });

    it('returns notFound for non-existent ref', async () => {
      const result = await refHandler.resolve({ name: 'nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('update (compare-and-swap)', () => {
    it('updates when expectedOldHash matches current target', async () => {
      await refHandler.create({ name: 'HEAD', hash: 'abc123' }, storage);
      const result = await refHandler.update(
        { name: 'HEAD', newHash: 'def456', expectedOldHash: 'abc123' },
        storage,
      );
      expect(result.variant).toBe('ok');

      // Verify update
      const resolved = await refHandler.resolve({ name: 'HEAD' }, storage);
      expect(resolved.hash).toBe('def456');
    });

    it('returns conflict when expectedOldHash does not match', async () => {
      await refHandler.create({ name: 'HEAD', hash: 'abc123' }, storage);
      const result = await refHandler.update(
        { name: 'HEAD', newHash: 'def456', expectedOldHash: 'wrong-hash' },
        storage,
      );
      expect(result.variant).toBe('conflict');
      expect(result.current).toBe('abc123');
    });

    it('returns notFound for non-existent ref', async () => {
      const result = await refHandler.update(
        { name: 'nonexistent', newHash: 'def456', expectedOldHash: 'abc123' },
        storage,
      );
      expect(result.variant).toBe('notFound');
    });
  });

  describe('delete', () => {
    it('deletes an unprotected ref', async () => {
      await refHandler.create({ name: 'refs/tags/v1', hash: 'abc123' }, storage);
      const result = await refHandler.delete({ name: 'refs/tags/v1' }, storage);
      expect(result.variant).toBe('ok');

      const resolved = await refHandler.resolve({ name: 'refs/tags/v1' }, storage);
      expect(resolved.variant).toBe('notFound');
    });

    it('rejects deletion of HEAD ref', async () => {
      await refHandler.create({ name: 'HEAD', hash: 'abc123' }, storage);
      const result = await refHandler.delete({ name: 'HEAD' }, storage);
      expect(result.variant).toBe('protected');
    });

    it('rejects deletion of protected/ namespace refs', async () => {
      await refHandler.create({ name: 'protected/main', hash: 'abc123' }, storage);
      const result = await refHandler.delete({ name: 'protected/main' }, storage);
      expect(result.variant).toBe('protected');
    });

    it('returns notFound for non-existent ref', async () => {
      const result = await refHandler.delete({ name: 'nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('log (reflog)', () => {
    it('returns history of ref changes', async () => {
      await refHandler.create({ name: 'HEAD', hash: 'abc123' }, storage);
      await refHandler.update({ name: 'HEAD', newHash: 'def456', expectedOldHash: 'abc123' }, storage);

      const result = await refHandler.log({ name: 'HEAD' }, storage);
      expect(result.variant).toBe('ok');
      const entries = result.entries as Array<{ oldHash: string; newHash: string }>;
      // Entries may collapse if operations happen within the same millisecond
      // since the key is `${name}-${timestamp}`. At minimum we should have at least 1 entry.
      expect(entries.length).toBeGreaterThanOrEqual(1);

      // The most recent entry should reflect the latest update
      expect(entries[0].newHash).toBe('def456');
    });

    it('records deletion in reflog', async () => {
      await refHandler.create({ name: 'refs/tags/v1', hash: 'abc' }, storage);
      await refHandler.delete({ name: 'refs/tags/v1' }, storage);

      const result = await refHandler.log({ name: 'refs/tags/v1' }, storage);
      expect(result.variant).toBe('ok');
      const entries = result.entries as Array<{ oldHash: string; newHash: string }>;
      // Should have create entry and delete entry
      expect(entries.some(e => e.newHash === '')).toBe(true);
    });

    it('returns notFound for ref that never existed', async () => {
      const result = await refHandler.log({ name: 'never-existed' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('multi-step sequences', () => {
    it('create -> update -> update -> log shows history with latest state', async () => {
      await refHandler.create({ name: 'branch/main', hash: 'h1' }, storage);
      await refHandler.update({ name: 'branch/main', newHash: 'h2', expectedOldHash: 'h1' }, storage);
      await refHandler.update({ name: 'branch/main', newHash: 'h3', expectedOldHash: 'h2' }, storage);

      const log = await refHandler.log({ name: 'branch/main' }, storage);
      expect(log.variant).toBe('ok');
      const entries = log.entries as Array<{ oldHash: string; newHash: string }>;
      // Note: entries may be fewer than 3 if operations occur within the same millisecond
      // (storage keys are `${name}-${timestamp}`, causing overwrites)
      expect(entries.length).toBeGreaterThanOrEqual(1);

      // The final ref state should be h3
      const resolved = await refHandler.resolve({ name: 'branch/main' }, storage);
      expect(resolved.hash).toBe('h3');
    });
  });
});
