// HistogramDiff provider tests -- algorithm behavior with frequency-based anchoring.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { histogramDiffHandler, resetHistogramDiffCounter } from '../handlers/ts/histogram-diff.handler.js';

describe('HistogramDiff', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetHistogramDiffCounter();
  });

  describe('register', () => {
    it('returns provider metadata', async () => {
      const result = await histogramDiffHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('histogram');
      expect(result.category).toBe('diff');
      expect(result.contentTypes).toContain('text/plain');
    });
  });

  describe('compute', () => {
    it('returns zero distance for identical content', async () => {
      const content = 'line1\nline2\nline3';
      const result = await histogramDiffHandler.compute(
        { contentA: content, contentB: content },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.distance).toBe(0);

      const ops = JSON.parse(result.editScript as string);
      expect(ops.every((op: { type: string }) => op.type === 'equal')).toBe(true);
    });

    it('detects single-line insertion', async () => {
      const contentA = 'line1\nline3';
      const contentB = 'line1\nline2\nline3';

      const result = await histogramDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');
      expect(result.distance).toBeGreaterThan(0);

      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; content: string }>;
      expect(ops.some(op => op.type === 'insert' && op.content === 'line2')).toBe(true);
    });

    it('detects single-line deletion', async () => {
      const contentA = 'line1\nline2\nline3';
      const contentB = 'line1\nline3';

      const result = await histogramDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');

      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; content: string }>;
      expect(ops.some(op => op.type === 'delete' && op.content === 'line2')).toBe(true);
    });

    it('handles completely different content', async () => {
      const contentA = 'aaa\nbbb\nccc';
      const contentB = 'xxx\nyyy\nzzz';

      const result = await histogramDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');
      expect(result.distance).toBeGreaterThan(0);
    });

    it('uses low-frequency lines as anchors for better diffs', async () => {
      // The unique "marker" line should anchor the diff more effectively
      const contentA = 'common\ncommon\nUNIQUE_MARKER\ncommon\ncommon';
      const contentB = 'common\ncommon\nnew-line\nUNIQUE_MARKER\ncommon\ncommon';

      const result = await histogramDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');

      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; content: string }>;
      // The unique marker should appear as 'equal'
      expect(ops.some(op => op.type === 'equal' && op.content === 'UNIQUE_MARKER')).toBe(true);
    });

    it('handles empty content on one side', async () => {
      const result = await histogramDiffHandler.compute({ contentA: '', contentB: 'new-content' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.distance).toBeGreaterThan(0);
    });

    it('handles empty content on both sides', async () => {
      const result = await histogramDiffHandler.compute({ contentA: '', contentB: '' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.distance).toBe(0);
    });

    it('produces valid JSON edit script', async () => {
      const result = await histogramDiffHandler.compute(
        { contentA: 'a\nb\nc', contentB: 'a\nx\nc' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const ops = JSON.parse(result.editScript as string);
      expect(Array.isArray(ops)).toBe(true);
      for (const op of ops) {
        expect(['equal', 'insert', 'delete']).toContain(op.type);
      }
    });

    it('handles source code with boilerplate lines', async () => {
      const contentA = '{\n  "name": "foo",\n  "value": 1\n}';
      const contentB = '{\n  "name": "foo",\n  "value": 2,\n  "extra": true\n}';

      const result = await histogramDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');
      expect(result.distance).toBeGreaterThan(0);
    });
  });
});
