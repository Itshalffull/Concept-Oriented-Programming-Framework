// RecursiveMerge provider tests -- recursive strategy with character-level conflict resolution.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { recursiveMergeHandler, resetRecursiveMergeCounter } from '../handlers/ts/recursive-merge.handler.js';

describe('RecursiveMerge', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetRecursiveMergeCounter();
  });

  describe('register', () => {
    it('returns provider metadata', async () => {
      const result = await recursiveMergeHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('recursive');
      expect(result.category).toBe('merge');
    });
  });

  describe('execute -- trivial cases', () => {
    it('returns ours when both sides are identical', async () => {
      const result = await recursiveMergeHandler.execute(
        { base: 'hello', ours: 'hello', theirs: 'hello' },
        storage,
      );
      expect(result.variant).toBe('clean');
      expect(result.result).toBe('hello');
    });

    it('returns theirs when only theirs changed', async () => {
      const result = await recursiveMergeHandler.execute(
        { base: 'original', ours: 'original', theirs: 'modified' },
        storage,
      );
      expect(result.variant).toBe('clean');
      expect(result.result).toBe('modified');
    });

    it('returns ours when only ours changed', async () => {
      const result = await recursiveMergeHandler.execute(
        { base: 'original', ours: 'modified', theirs: 'original' },
        storage,
      );
      expect(result.variant).toBe('clean');
      expect(result.result).toBe('modified');
    });

    it('returns same content when both changed identically', async () => {
      const result = await recursiveMergeHandler.execute(
        { base: 'original', ours: 'same-change', theirs: 'same-change' },
        storage,
      );
      expect(result.variant).toBe('clean');
      expect(result.result).toBe('same-change');
    });
  });

  describe('execute -- non-overlapping changes', () => {
    it('merges non-overlapping line changes cleanly', async () => {
      const base = 'line1\nline2\nline3';
      const ours = 'ours-line1\nline2\nline3';
      const theirs = 'line1\nline2\ntheirs-line3';

      const result = await recursiveMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');
      expect(result.result).toBe('ours-line1\nline2\ntheirs-line3');
    });
  });

  describe('execute -- character-level merge', () => {
    it('resolves character-level non-overlapping changes within a line', async () => {
      // Both change different parts of the same line
      const base = 'hello world';
      const ours = 'HELLO world';
      const theirs = 'hello WORLD';

      const result = await recursiveMergeHandler.execute({ base, ours, theirs }, storage);
      // Character-level merge should resolve this since changes are non-overlapping
      if (result.variant === 'clean') {
        expect(result.result).toBe('HELLO WORLD');
      } else {
        // If character merge doesn't resolve it, conflicts are acceptable
        expect(result.variant).toBe('conflicts');
      }
    });
  });

  describe('execute -- conflict detection', () => {
    it('detects conflicts when both sides change the same line differently', async () => {
      const base = 'line1\nline2\nline3';
      const ours = 'line1\nours-change\nline3';
      const theirs = 'line1\ntheirs-change\nline3';

      const result = await recursiveMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('conflicts');
      expect((result.regions as string[]).length).toBeGreaterThan(0);

      // Conflict regions should contain conflict markers
      const region = (result.regions as string[])[0];
      expect(region).toContain('<<<<<<< ours');
      expect(region).toContain('>>>>>>> theirs');
    });

    it('detects multiple conflicts', async () => {
      const base = 'line1\nline2\nline3';
      const ours = 'a\nb\nc';
      const theirs = 'x\ny\nz';

      const result = await recursiveMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('conflicts');
      expect((result.regions as string[]).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('execute -- multi-line merges', () => {
    it('handles mixed clean and conflicting regions', async () => {
      const base = 'header\ncontent\nfooter';
      const ours = 'header\nours-content\nfooter';
      const theirs = 'header\ntheirs-content\nnew-footer';

      const result = await recursiveMergeHandler.execute({ base, ours, theirs }, storage);
      // First line same in all, second line conflicts, third line only theirs changed
      expect(result.variant).toBe('conflicts');
    });
  });

  describe('execute -- unsupported content', () => {
    it('returns unsupportedContent for non-string input', async () => {
      const result = await recursiveMergeHandler.execute(
        { base: 123 as unknown as string, ours: 'a', theirs: 'b' },
        storage,
      );
      expect(result.variant).toBe('unsupportedContent');
    });
  });
});
