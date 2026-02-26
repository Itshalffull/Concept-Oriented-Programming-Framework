// ThreeWayMerge provider tests -- classic three-way merge algorithm with conflict detection.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { threeWayMergeHandler, resetThreeWayMergeCounter } from '../implementations/typescript/three-way-merge.impl.js';

describe('ThreeWayMerge', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetThreeWayMergeCounter();
  });

  describe('register', () => {
    it('returns provider metadata', async () => {
      const result = await threeWayMergeHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('three-way');
      expect(result.category).toBe('merge');
    });
  });

  describe('execute -- trivial cases', () => {
    it('returns ours when both sides are identical', async () => {
      const result = await threeWayMergeHandler.execute(
        { base: 'same', ours: 'same', theirs: 'same' },
        storage,
      );
      expect(result.variant).toBe('clean');
      expect(result.result).toBe('same');
    });

    it('returns theirs when only theirs changed', async () => {
      const result = await threeWayMergeHandler.execute(
        { base: 'original', ours: 'original', theirs: 'modified' },
        storage,
      );
      expect(result.variant).toBe('clean');
      expect(result.result).toBe('modified');
    });

    it('returns ours when only ours changed', async () => {
      const result = await threeWayMergeHandler.execute(
        { base: 'original', ours: 'modified', theirs: 'original' },
        storage,
      );
      expect(result.variant).toBe('clean');
      expect(result.result).toBe('modified');
    });

    it('returns same when both changed identically', async () => {
      const result = await threeWayMergeHandler.execute(
        { base: 'original', ours: 'same-change', theirs: 'same-change' },
        storage,
      );
      expect(result.variant).toBe('clean');
      expect(result.result).toBe('same-change');
    });
  });

  describe('execute -- non-overlapping changes', () => {
    it('merges changes to different lines cleanly', async () => {
      const base = 'line1\nline2\nline3';
      const ours = 'changed1\nline2\nline3';
      const theirs = 'line1\nline2\nchanged3';

      const result = await threeWayMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');
      expect(result.result).toBe('changed1\nline2\nchanged3');
    });

    it('merges non-overlapping multi-line edits', async () => {
      const base = 'a\nb\nc\nd\ne';
      const ours = 'A\nb\nc\nd\ne';
      const theirs = 'a\nb\nc\nd\nE';

      const result = await threeWayMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');
      expect(result.result).toBe('A\nb\nc\nd\nE');
    });
  });

  describe('execute -- conflict detection', () => {
    it('detects single-line conflict', async () => {
      const base = 'line1\nline2\nline3';
      const ours = 'line1\nours\nline3';
      const theirs = 'line1\ntheirs\nline3';

      const result = await threeWayMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('conflicts');
      expect((result.regions as string[]).length).toBe(1);

      const region = (result.regions as string[])[0];
      expect(region).toContain('<<<<<<< ours');
      expect(region).toContain('ours');
      expect(region).toContain('=======');
      expect(region).toContain('theirs');
      expect(region).toContain('>>>>>>> theirs');
    });

    it('detects multiple conflicts', async () => {
      const base = 'a\nb\nc';
      const ours = 'x\ny\nz';
      const theirs = 'p\nq\nr';

      const result = await threeWayMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('conflicts');
      expect((result.regions as string[]).length).toBe(3);
    });

    it('detects conflict with asymmetric lengths', async () => {
      const base = 'line1\nline2';
      const ours = 'line1\nline2\nours-extra';
      const theirs = 'line1\nline2\ntheirs-extra';

      const result = await threeWayMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('conflicts');
    });
  });

  describe('execute -- edge cases', () => {
    it('handles empty base with divergent additions', async () => {
      const result = await threeWayMergeHandler.execute(
        { base: '', ours: 'ours-content', theirs: 'theirs-content' },
        storage,
      );
      expect(result.variant).toBe('conflicts');
    });

    it('handles one side adding content to empty base', async () => {
      const result = await threeWayMergeHandler.execute(
        { base: '', ours: '', theirs: 'added' },
        storage,
      );
      expect(result.variant).toBe('clean');
      expect(result.result).toBe('added');
    });

    it('handles one side deleting and other keeping', async () => {
      const base = 'line1\nline2';
      const ours = 'line1';
      const theirs = 'line1\nline2';

      const result = await threeWayMergeHandler.execute({ base, ours, theirs }, storage);
      // ours deleted line2 while theirs kept it -- ours change should win
      expect(result.variant).toBe('clean');
    });
  });

  describe('execute -- unsupported content', () => {
    it('returns unsupportedContent for non-string input', async () => {
      const result = await threeWayMergeHandler.execute(
        { base: 'a', ours: 123 as unknown as string, theirs: 'b' },
        storage,
      );
      expect(result.variant).toBe('unsupportedContent');
    });
  });

  describe('real-world scenarios', () => {
    it('merges configuration file changes cleanly', async () => {
      const base = [
        'host=localhost',
        'port=8080',
        'debug=false',
        'log_level=info',
      ].join('\n');

      const ours = [
        'host=localhost',
        'port=9090',
        'debug=false',
        'log_level=info',
      ].join('\n');

      const theirs = [
        'host=localhost',
        'port=8080',
        'debug=true',
        'log_level=info',
      ].join('\n');

      const result = await threeWayMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');
      expect(result.result).toBe([
        'host=localhost',
        'port=9090',
        'debug=true',
        'log_level=info',
      ].join('\n'));
    });
  });
});
