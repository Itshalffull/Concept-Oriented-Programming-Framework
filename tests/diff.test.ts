// Diff concept handler tests -- registerProvider, diff computation, and patch application.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { diffHandler, resetDiffCounter } from '../handlers/ts/diff.handler.js';

describe('Diff', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetDiffCounter();
  });

  describe('registerProvider', () => {
    it('registers a new diff provider', async () => {
      const result = await diffHandler.registerProvider(
        { name: 'custom-diff', contentTypes: ['text/plain'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.provider).toBeDefined();
    });

    it('rejects duplicate provider names', async () => {
      await diffHandler.registerProvider({ name: 'custom-diff', contentTypes: ['text/plain'] }, storage);
      const result = await diffHandler.registerProvider({ name: 'custom-diff', contentTypes: ['text/plain'] }, storage);
      expect(result.variant).toBe('duplicate');
    });
  });

  describe('diff', () => {
    it('returns identical for same content', async () => {
      const result = await diffHandler.diff(
        { contentA: 'hello\nworld', contentB: 'hello\nworld' },
        storage,
      );
      expect(result.variant).toBe('identical');
    });

    it('computes edit script and distance for different content', async () => {
      const result = await diffHandler.diff(
        { contentA: 'hello\nworld', contentB: 'hello\nearth' },
        storage,
      );
      expect(result.variant).toBe('diffed');
      expect(result.distance).toBeGreaterThan(0);
      expect(typeof result.editScript).toBe('string');

      // Verify edit script is valid JSON
      const ops = JSON.parse(result.editScript as string);
      expect(Array.isArray(ops)).toBe(true);
    });

    it('detects insertions', async () => {
      const result = await diffHandler.diff(
        { contentA: 'line1\nline2', contentB: 'line1\nnew-line\nline2' },
        storage,
      );
      expect(result.variant).toBe('diffed');
      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; content: string }>;
      expect(ops.some(op => op.type === 'insert' && op.content === 'new-line')).toBe(true);
    });

    it('detects deletions', async () => {
      const result = await diffHandler.diff(
        { contentA: 'line1\nremove-me\nline2', contentB: 'line1\nline2' },
        storage,
      );
      expect(result.variant).toBe('diffed');
      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; content: string }>;
      expect(ops.some(op => op.type === 'delete' && op.content === 'remove-me')).toBe(true);
    });

    it('returns noProvider for unregistered algorithm', async () => {
      const result = await diffHandler.diff(
        { contentA: 'a', contentB: 'b', algorithm: 'nonexistent-algo' },
        storage,
      );
      expect(result.variant).toBe('noProvider');
    });
  });

  describe('patch', () => {
    it('applies an edit script to reconstruct target content', async () => {
      const contentA = 'hello\nworld';
      const contentB = 'hello\nearth';

      const diffResult = await diffHandler.diff({ contentA, contentB }, storage);
      const editScript = diffResult.editScript as string;

      const patchResult = await diffHandler.patch({ content: contentA, editScript }, storage);
      expect(patchResult.variant).toBe('ok');
      expect(patchResult.result).toBe(contentB);
    });

    it('returns incompatible for invalid edit script JSON', async () => {
      const result = await diffHandler.patch({ content: 'hello', editScript: 'not-json' }, storage);
      expect(result.variant).toBe('incompatible');
    });

    it('round-trips multi-line content correctly', async () => {
      const contentA = 'function foo() {\n  return 1;\n}';
      const contentB = 'function foo() {\n  return 2;\n}\n\nfunction bar() {\n  return 3;\n}';

      const diffResult = await diffHandler.diff({ contentA, contentB }, storage);
      const patchResult = await diffHandler.patch({
        content: contentA,
        editScript: diffResult.editScript as string,
      }, storage);
      expect(patchResult.variant).toBe('ok');
      expect(patchResult.result).toBe(contentB);
    });
  });
});
