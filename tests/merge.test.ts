// Merge concept handler tests -- registerStrategy, merge, resolveConflict, and finalize.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { mergeHandler, resetMergeCounter } from '../handlers/ts/merge.handler.js';

describe('Merge', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetMergeCounter();
  });

  describe('registerStrategy', () => {
    it('registers a merge strategy', async () => {
      const result = await mergeHandler.registerStrategy(
        { name: 'custom-merge', contentTypes: ['text/plain'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.strategy).toBeDefined();
    });

    it('rejects duplicate strategy names', async () => {
      await mergeHandler.registerStrategy({ name: 'custom', contentTypes: [] }, storage);
      const result = await mergeHandler.registerStrategy({ name: 'custom', contentTypes: [] }, storage);
      expect(result.variant).toBe('duplicate');
    });
  });

  describe('merge', () => {
    it('produces clean result when only one side changed', async () => {
      const base = 'line1\nline2\nline3';
      const ours = 'line1\nmodified\nline3';
      const theirs = 'line1\nline2\nline3';

      const result = await mergeHandler.merge({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');
      expect(result.result).toBe('line1\nmodified\nline3');
    });

    it('produces clean result when both sides make the same change', async () => {
      const base = 'line1\nline2';
      const ours = 'line1\nchanged';
      const theirs = 'line1\nchanged';

      const result = await mergeHandler.merge({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');
      expect(result.result).toBe('line1\nchanged');
    });

    it('detects conflicts when both sides change the same line differently', async () => {
      const base = 'line1\nline2\nline3';
      const ours = 'line1\nours-change\nline3';
      const theirs = 'line1\ntheirs-change\nline3';

      const result = await mergeHandler.merge({ base, ours, theirs }, storage);
      expect(result.variant).toBe('conflicts');
      expect(result.conflictCount).toBe(1);
      expect(result.mergeId).toBeDefined();
    });

    it('returns noStrategy for unregistered strategy', async () => {
      const result = await mergeHandler.merge(
        { base: 'a', ours: 'b', theirs: 'c', strategy: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('noStrategy');
    });

    it('merges non-overlapping changes cleanly', async () => {
      const base = 'line1\nline2\nline3';
      const ours = 'ours-line1\nline2\nline3';
      const theirs = 'line1\nline2\ntheirs-line3';

      const result = await mergeHandler.merge({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');
      expect(result.result).toBe('ours-line1\nline2\ntheirs-line3');
    });
  });

  describe('resolveConflict', () => {
    it('resolves a conflict and decrements remaining count', async () => {
      const base = 'line1\nline2';
      const ours = 'line1\nours';
      const theirs = 'line1\ntheirs';

      const mergeResult = await mergeHandler.merge({ base, ours, theirs }, storage);
      const mergeId = mergeResult.mergeId as string;

      const result = await mergeHandler.resolveConflict(
        { mergeId, conflictIndex: 0, resolution: 'chosen-line' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.remaining).toBe(0);
    });

    it('returns invalidIndex for out-of-range conflict index', async () => {
      const base = 'a';
      const ours = 'b';
      const theirs = 'c';

      const mergeResult = await mergeHandler.merge({ base, ours, theirs }, storage);
      const mergeId = mergeResult.mergeId as string;

      const result = await mergeHandler.resolveConflict(
        { mergeId, conflictIndex: 99, resolution: 'x' },
        storage,
      );
      expect(result.variant).toBe('invalidIndex');
    });

    it('returns alreadyResolved for double-resolved conflict', async () => {
      const base = 'a';
      const ours = 'b';
      const theirs = 'c';

      const mergeResult = await mergeHandler.merge({ base, ours, theirs }, storage);
      const mergeId = mergeResult.mergeId as string;

      await mergeHandler.resolveConflict({ mergeId, conflictIndex: 0, resolution: 'x' }, storage);
      const result = await mergeHandler.resolveConflict(
        { mergeId, conflictIndex: 0, resolution: 'y' },
        storage,
      );
      expect(result.variant).toBe('alreadyResolved');
    });

    it('returns invalidIndex for non-existent merge', async () => {
      const result = await mergeHandler.resolveConflict(
        { mergeId: 'nonexistent', conflictIndex: 0, resolution: 'x' },
        storage,
      );
      expect(result.variant).toBe('invalidIndex');
    });
  });

  describe('finalize', () => {
    it('produces final result after all conflicts resolved', async () => {
      const base = 'line1\nline2';
      const ours = 'line1\nours-line';
      const theirs = 'line1\ntheirs-line';

      const mergeResult = await mergeHandler.merge({ base, ours, theirs }, storage);
      const mergeId = mergeResult.mergeId as string;

      await mergeHandler.resolveConflict(
        { mergeId, conflictIndex: 0, resolution: 'resolved-line' },
        storage,
      );

      const result = await mergeHandler.finalize({ mergeId }, storage);
      expect(result.variant).toBe('ok');
      expect(result.result).toBe('line1\nresolved-line');
    });

    it('rejects finalize with unresolved conflicts', async () => {
      const base = 'a\nb';
      const ours = 'x\ny';
      const theirs = 'p\nq';

      const mergeResult = await mergeHandler.merge({ base, ours, theirs }, storage);
      const mergeId = mergeResult.mergeId as string;

      const result = await mergeHandler.finalize({ mergeId }, storage);
      expect(result.variant).toBe('unresolvedConflicts');
      expect((result.count as number)).toBeGreaterThan(0);
    });
  });

  describe('full conflict resolution workflow', () => {
    it('merge -> resolve all -> finalize', async () => {
      const base = 'line1\nline2\nline3';
      const ours = 'changed1\nchanged2\nline3';
      const theirs = 'other1\nother2\nline3';

      const mergeResult = await mergeHandler.merge({ base, ours, theirs }, storage);
      expect(mergeResult.variant).toBe('conflicts');
      const mergeId = mergeResult.mergeId as string;
      const count = mergeResult.conflictCount as number;

      for (let i = 0; i < count; i++) {
        await mergeHandler.resolveConflict(
          { mergeId, conflictIndex: i, resolution: `resolved-${i}` },
          storage,
        );
      }

      const final = await mergeHandler.finalize({ mergeId }, storage);
      expect(final.variant).toBe('ok');
      expect(typeof final.result).toBe('string');
    });
  });
});
