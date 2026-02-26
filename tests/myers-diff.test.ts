// MyersDiff provider tests -- O(ND) algorithm behavior for minimal edit distance.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { myersDiffHandler, resetMyersDiffCounter } from '../handlers/ts/myers-diff.handler.js';

describe('MyersDiff', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetMyersDiffCounter();
  });

  describe('register', () => {
    it('returns provider metadata', async () => {
      const result = await myersDiffHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('myers');
      expect(result.category).toBe('diff');
      expect(result.contentTypes).toContain('text/plain');
    });
  });

  describe('compute', () => {
    it('returns zero distance for identical content', async () => {
      const content = 'hello\nworld';
      const result = await myersDiffHandler.compute(
        { contentA: content, contentB: content },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.distance).toBe(0);
    });

    it('computes minimal edit distance for simple substitution', async () => {
      const contentA = 'line1\nline2\nline3';
      const contentB = 'line1\nchanged\nline3';

      const result = await myersDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');
      // Should be 2 edits: delete 'line2' + insert 'changed'
      expect(result.distance).toBe(2);
    });

    it('detects pure insertion', async () => {
      const contentA = 'line1\nline3';
      const contentB = 'line1\nline2\nline3';

      const result = await myersDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');
      expect(result.distance).toBe(1);

      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; content: string }>;
      expect(ops.some(op => op.type === 'insert' && op.content === 'line2')).toBe(true);
    });

    it('detects pure deletion', async () => {
      const contentA = 'line1\nline2\nline3';
      const contentB = 'line1\nline3';

      const result = await myersDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');
      expect(result.distance).toBe(1);

      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; content: string }>;
      expect(ops.some(op => op.type === 'delete' && op.content === 'line2')).toBe(true);
    });

    it('handles empty A (inserts dominate)', async () => {
      const result = await myersDiffHandler.compute(
        { contentA: '', contentB: 'new\ncontent' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.distance).toBeGreaterThan(0);

      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; content: string }>;
      // Note: '' splits to [''], so there may be an equal for the empty line.
      // At least one insert should be present.
      expect(ops.some(op => op.type === 'insert')).toBe(true);
    });

    it('handles empty B (deletes dominate)', async () => {
      const result = await myersDiffHandler.compute(
        { contentA: 'old\ncontent', contentB: '' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.distance).toBeGreaterThan(0);

      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; content: string }>;
      // Note: '' splits to [''], so there may be an equal for the empty line.
      // At least one delete should be present.
      expect(ops.some(op => op.type === 'delete')).toBe(true);
    });

    it('handles both empty', async () => {
      const result = await myersDiffHandler.compute({ contentA: '', contentB: '' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.distance).toBe(0);
    });

    it('produces correct edit script for multi-line diff', async () => {
      const contentA = 'function foo() {\n  return 1;\n}';
      const contentB = 'function foo() {\n  return 2;\n}';

      const result = await myersDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');
      expect(result.distance).toBe(2); // delete old return + insert new return

      // Verify the edit script preserves unchanged lines
      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; content: string }>;
      expect(ops.some(op => op.type === 'equal' && op.content === 'function foo() {')).toBe(true);
      expect(ops.some(op => op.type === 'equal' && op.content === '}')).toBe(true);
    });

    it('caches results in storage', async () => {
      await myersDiffHandler.compute({ contentA: 'a', contentB: 'b' }, storage);
      const cached = await storage.find('myers-diff', {});
      expect(cached.length).toBe(1);
    });

    it('applies edit script to reconstruct target', async () => {
      const contentA = 'alpha\nbeta\ngamma';
      const contentB = 'alpha\ndelta\ngamma';

      const result = await myersDiffHandler.compute({ contentA, contentB }, storage);
      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; content: string }>;

      // Reconstruct by keeping equal and insert, dropping delete
      const reconstructed = ops
        .filter(op => op.type === 'equal' || op.type === 'insert')
        .map(op => op.content)
        .join('\n');
      expect(reconstructed).toBe(contentB);
    });
  });
});
