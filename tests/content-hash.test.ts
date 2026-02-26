// ContentHash concept handler tests -- store, retrieve, verify, and delete with deduplication.

import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { contentHashHandler, resetContentHashCounter } from '../implementations/typescript/content-hash.impl.js';

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

describe('ContentHash', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetContentHashCounter();
  });

  describe('store', () => {
    it('stores content and returns its SHA-256 digest', async () => {
      const content = 'hello world';
      const result = await contentHashHandler.store({ content }, storage);
      expect(result.variant).toBe('ok');
      expect(result.hash).toBe(sha256(content));
    });

    it('returns alreadyExists for duplicate content', async () => {
      const content = 'same content';
      await contentHashHandler.store({ content }, storage);
      const result = await contentHashHandler.store({ content }, storage);
      expect(result.variant).toBe('alreadyExists');
      expect(result.hash).toBe(sha256(content));
    });

    it('stores different content under different hashes', async () => {
      const r1 = await contentHashHandler.store({ content: 'aaa' }, storage);
      const r2 = await contentHashHandler.store({ content: 'bbb' }, storage);
      expect(r1.hash).not.toBe(r2.hash);
    });
  });

  describe('retrieve', () => {
    it('retrieves previously stored content by hash', async () => {
      const content = 'retrievable content';
      const stored = await contentHashHandler.store({ content }, storage);
      const result = await contentHashHandler.retrieve({ hash: stored.hash as string }, storage);
      expect(result.variant).toBe('ok');
      expect(result.content).toBe(content);
    });

    it('returns notFound for unknown hash', async () => {
      const result = await contentHashHandler.retrieve({ hash: 'deadbeef' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('verify', () => {
    it('returns valid when content matches stored hash', async () => {
      const content = 'verifiable content';
      const stored = await contentHashHandler.store({ content }, storage);
      const result = await contentHashHandler.verify({ hash: stored.hash as string, content }, storage);
      expect(result.variant).toBe('valid');
    });

    it('returns corrupt when content does not match hash', async () => {
      const content = 'original content';
      const stored = await contentHashHandler.store({ content }, storage);
      const result = await contentHashHandler.verify({ hash: stored.hash as string, content: 'tampered content' }, storage);
      expect(result.variant).toBe('corrupt');
      expect(result.expected).toBe(stored.hash);
      expect(result.actual).toBe(sha256('tampered content'));
    });

    it('returns notFound when hash is not in store', async () => {
      const result = await contentHashHandler.verify({ hash: 'unknownhash', content: 'anything' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('delete', () => {
    it('deletes unreferenced content', async () => {
      const content = 'deletable content';
      const stored = await contentHashHandler.store({ content }, storage);
      const result = await contentHashHandler.delete({ hash: stored.hash as string }, storage);
      expect(result.variant).toBe('ok');

      // Verify it is gone
      const check = await contentHashHandler.retrieve({ hash: stored.hash as string }, storage);
      expect(check.variant).toBe('notFound');
    });

    it('returns notFound for unknown hash', async () => {
      const result = await contentHashHandler.delete({ hash: 'unknownhash' }, storage);
      expect(result.variant).toBe('notFound');
    });

    it('returns referenced when content has active refs', async () => {
      const content = 'important content';
      const stored = await contentHashHandler.store({ content }, storage);
      const hash = stored.hash as string;

      // Create a ref pointing to this hash
      await storage.put('ref', 'ref-1', { name: 'HEAD', target: hash });

      const result = await contentHashHandler.delete({ hash }, storage);
      expect(result.variant).toBe('referenced');
    });
  });

  describe('round-trip integrity', () => {
    it('store -> retrieve -> verify preserves content integrity', async () => {
      const content = 'line 1\nline 2\nline 3';
      const stored = await contentHashHandler.store({ content }, storage);
      const retrieved = await contentHashHandler.retrieve({ hash: stored.hash as string }, storage);
      const verified = await contentHashHandler.verify({ hash: stored.hash as string, content: retrieved.content as string }, storage);
      expect(verified.variant).toBe('valid');
    });
  });
});
