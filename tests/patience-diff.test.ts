// PatienceDiff provider tests -- unique-line anchoring and LIS-based alignment.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { patienceDiffHandler, resetPatienceDiffCounter } from '../handlers/ts/patience-diff.handler.js';

describe('PatienceDiff', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetPatienceDiffCounter();
  });

  describe('register', () => {
    it('returns provider metadata', async () => {
      const result = await patienceDiffHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('patience');
      expect(result.category).toBe('diff');
    });
  });

  describe('compute', () => {
    it('returns zero distance for identical content', async () => {
      const content = 'alpha\nbeta\ngamma';
      const result = await patienceDiffHandler.compute(
        { contentA: content, contentB: content },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.distance).toBe(0);
    });

    it('detects simple insertions', async () => {
      const contentA = 'function foo() {\n  return 1;\n}';
      const contentB = 'function foo() {\n  // comment\n  return 1;\n}';

      const result = await patienceDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');
      expect(result.distance).toBeGreaterThan(0);

      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; content: string }>;
      expect(ops.some(op => op.type === 'insert' && op.content === '  // comment')).toBe(true);
    });

    it('anchors on unique lines for better alignment', async () => {
      // Unique lines: "function unique_a" and "function unique_b" should anchor the diff
      const contentA = [
        'common line',
        'function unique_a() {',
        '  return 1;',
        '}',
        'common line',
        'function unique_b() {',
        '  return 2;',
        '}',
      ].join('\n');

      const contentB = [
        'common line',
        'function unique_a() {',
        '  return 10;',
        '}',
        'common line',
        'function unique_b() {',
        '  return 2;',
        '}',
      ].join('\n');

      const result = await patienceDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');

      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; content: string }>;
      // unique function signatures should remain as 'equal'
      expect(ops.some(op => op.type === 'equal' && op.content === 'function unique_a() {')).toBe(true);
      expect(ops.some(op => op.type === 'equal' && op.content === 'function unique_b() {')).toBe(true);
    });

    it('falls back to LCS diff when no unique lines exist', async () => {
      const contentA = 'x\nx\nx';
      const contentB = 'x\ny\nx';

      const result = await patienceDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');
      expect(result.distance).toBeGreaterThan(0);
    });

    it('handles empty inputs', async () => {
      const r1 = await patienceDiffHandler.compute({ contentA: '', contentB: 'new' }, storage);
      expect(r1.variant).toBe('ok');
      expect(r1.distance).toBeGreaterThan(0);

      resetPatienceDiffCounter();
      const r2 = await patienceDiffHandler.compute({ contentA: 'old', contentB: '' }, storage);
      expect(r2.variant).toBe('ok');
      expect(r2.distance).toBeGreaterThan(0);
    });

    it('reconstructs target from edit script', async () => {
      const contentA = 'line1\nline2\nline3\nline4';
      const contentB = 'line1\nnew-line\nline3\nline4';

      const result = await patienceDiffHandler.compute({ contentA, contentB }, storage);
      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; content: string }>;

      const reconstructed = ops
        .filter(op => op.type === 'equal' || op.type === 'insert')
        .map(op => op.content)
        .join('\n');
      expect(reconstructed).toBe(contentB);
    });

    it('handles moved code blocks via unique anchors', async () => {
      // Reorder two unique blocks
      const contentA = 'import A\nimport B\n\nfunction alpha() {}\n\nfunction beta() {}';
      const contentB = 'import A\nimport B\nimport C\n\nfunction alpha() {}\n\nfunction beta() {}';

      const result = await patienceDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');

      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; content: string }>;
      expect(ops.some(op => op.type === 'insert' && op.content === 'import C')).toBe(true);
    });
  });
});
