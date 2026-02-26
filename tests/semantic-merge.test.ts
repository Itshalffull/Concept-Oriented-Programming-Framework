// SemanticMerge provider tests -- AST-level block merging with import deduplication.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { semanticMergeHandler, resetSemanticMergeCounter } from '../handlers/ts/semantic-merge.handler.js';

describe('SemanticMerge', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSemanticMergeCounter();
  });

  describe('register', () => {
    it('returns provider metadata', async () => {
      const result = await semanticMergeHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('semantic');
      expect(result.category).toBe('merge');
      expect(result.contentTypes).toContain('text/typescript');
    });
  });

  describe('execute -- trivial cases', () => {
    it('returns ours when both sides are identical', async () => {
      const code = 'import A\n\nfunction foo() {\n  return 1;\n}';
      const result = await semanticMergeHandler.execute(
        { base: code, ours: code, theirs: code },
        storage,
      );
      expect(result.variant).toBe('clean');
      expect(result.result).toBe(code);
    });

    it('returns theirs when only theirs changed', async () => {
      const base = 'function foo() {\n  return 1;\n}';
      const theirs = 'function foo() {\n  return 2;\n}';

      const result = await semanticMergeHandler.execute(
        { base, ours: base, theirs },
        storage,
      );
      expect(result.variant).toBe('clean');
      expect(result.result).toBe(theirs);
    });

    it('returns ours when only ours changed', async () => {
      const base = 'function foo() {\n  return 1;\n}';
      const ours = 'function foo() {\n  return 2;\n}';

      const result = await semanticMergeHandler.execute(
        { base, ours, theirs: base },
        storage,
      );
      expect(result.variant).toBe('clean');
      expect(result.result).toBe(ours);
    });
  });

  describe('execute -- import deduplication', () => {
    it('unions imports from both sides without duplicates', async () => {
      const base = 'import A';
      const ours = 'import A\nimport B';
      const theirs = 'import A\nimport C';

      const result = await semanticMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');

      const resultStr = result.result as string;
      expect(resultStr).toContain('import A');
      expect(resultStr).toContain('import B');
      expect(resultStr).toContain('import C');
    });

    it('does not duplicate common imports', async () => {
      const base = 'import A';
      const ours = 'import A\nimport B';
      const theirs = 'import A\nimport B';

      const result = await semanticMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');

      const importCount = (result.result as string).split('\n').filter(line => line.startsWith('import')).length;
      // Should have 2 unique imports, not 3
      expect(importCount).toBe(2);
    });
  });

  describe('execute -- function block merging', () => {
    it('merges independently changed functions cleanly', async () => {
      const base = [
        'function foo() {',
        '  return 1;',
        '}',
        '',
        'function bar() {',
        '  return 2;',
        '}',
      ].join('\n');

      const ours = [
        'function foo() {',
        '  return 10;',
        '}',
        '',
        'function bar() {',
        '  return 2;',
        '}',
      ].join('\n');

      const theirs = [
        'function foo() {',
        '  return 1;',
        '}',
        '',
        'function bar() {',
        '  return 20;',
        '}',
      ].join('\n');

      const result = await semanticMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');

      const resultStr = result.result as string;
      expect(resultStr).toContain('return 10;');
      expect(resultStr).toContain('return 20;');
    });

    it('detects conflicts when both sides modify the same function', async () => {
      const base = 'function foo() {\n  return 1;\n}';
      const ours = 'function foo() {\n  return 2;\n}';
      const theirs = 'function foo() {\n  return 3;\n}';

      const result = await semanticMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('conflicts');
      expect((result.regions as string[]).length).toBeGreaterThan(0);
    });
  });

  describe('execute -- new blocks', () => {
    it('includes new functions added by either side', async () => {
      const base = 'function foo() {\n  return 1;\n}';
      const ours = 'function foo() {\n  return 1;\n}\n\nfunction bar() {\n  return 2;\n}';
      const theirs = 'function foo() {\n  return 1;\n}\n\nfunction baz() {\n  return 3;\n}';

      const result = await semanticMergeHandler.execute({ base, ours, theirs }, storage);
      expect(result.variant).toBe('clean');

      const resultStr = result.result as string;
      expect(resultStr).toContain('function bar()');
      expect(resultStr).toContain('function baz()');
    });
  });

  describe('execute -- block deletion', () => {
    it('accepts deletion when the other side did not modify the block', async () => {
      const base = [
        'function foo() {',
        '  return 1;',
        '}',
        '',
        'function bar() {',
        '  return 2;',
        '}',
      ].join('\n');

      const ours = [
        'function foo() {',
        '  return 1;',
        '}',
        '',
        'function bar() {',
        '  return 2;',
        '}',
      ].join('\n');

      // Theirs deletes foo
      const theirs = [
        'function bar() {',
        '  return 2;',
        '}',
      ].join('\n');

      const result = await semanticMergeHandler.execute({ base, ours, theirs }, storage);
      // Theirs deleted foo and ours didn't modify it, so deletion should win
      expect(result.variant).toBe('clean');
      const resultStr = result.result as string;
      expect(resultStr).not.toContain('function foo()');
    });
  });

  describe('execute -- unsupported content', () => {
    it('returns unsupportedContent for non-string input', async () => {
      const result = await semanticMergeHandler.execute(
        { base: 42 as unknown as string, ours: 'a', theirs: 'b' },
        storage,
      );
      expect(result.variant).toBe('unsupportedContent');
    });
  });
});
