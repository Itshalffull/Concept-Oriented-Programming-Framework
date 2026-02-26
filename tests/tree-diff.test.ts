// TreeDiff provider tests -- structural JSON diffing with insert/delete/update/equal operations.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { treeDiffHandler, resetTreeDiffCounter } from '../implementations/typescript/tree-diff.impl.js';

describe('TreeDiff', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTreeDiffCounter();
  });

  describe('register', () => {
    it('returns provider metadata', async () => {
      const result = await treeDiffHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('tree');
      expect(result.category).toBe('diff');
      expect(result.contentTypes).toContain('application/json');
    });
  });

  describe('compute', () => {
    it('returns zero distance for identical JSON objects', async () => {
      const content = JSON.stringify({ name: 'test', value: 42 });
      const result = await treeDiffHandler.compute(
        { contentA: content, contentB: content },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.distance).toBe(0);
    });

    it('detects updated leaf values', async () => {
      const contentA = JSON.stringify({ name: 'foo', value: 1 });
      const contentB = JSON.stringify({ name: 'foo', value: 2 });

      const result = await treeDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');
      expect(result.distance).toBe(1);

      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; path: string; oldValue?: unknown; newValue?: unknown }>;
      const updateOp = ops.find(op => op.type === 'update');
      expect(updateOp).toBeDefined();
      expect(updateOp!.oldValue).toBe(1);
      expect(updateOp!.newValue).toBe(2);
    });

    it('detects inserted fields', async () => {
      const contentA = JSON.stringify({ name: 'foo' });
      const contentB = JSON.stringify({ name: 'foo', age: 30 });

      const result = await treeDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');

      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; path: string }>;
      expect(ops.some(op => op.type === 'insert' && op.path.includes('age'))).toBe(true);
    });

    it('detects deleted fields', async () => {
      const contentA = JSON.stringify({ name: 'foo', age: 30 });
      const contentB = JSON.stringify({ name: 'foo' });

      const result = await treeDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');

      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; path: string }>;
      expect(ops.some(op => op.type === 'delete' && op.path.includes('age'))).toBe(true);
    });

    it('diffs nested objects recursively', async () => {
      const contentA = JSON.stringify({ user: { name: 'Alice', role: 'admin' } });
      const contentB = JSON.stringify({ user: { name: 'Alice', role: 'editor' } });

      const result = await treeDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');
      expect(result.distance).toBe(1);

      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; path: string }>;
      expect(ops.some(op => op.type === 'update' && op.path.includes('role'))).toBe(true);
    });

    it('diffs arrays by index', async () => {
      const contentA = JSON.stringify({ items: [1, 2, 3] });
      const contentB = JSON.stringify({ items: [1, 2, 3, 4] });

      const result = await treeDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');

      const ops = JSON.parse(result.editScript as string) as Array<{ type: string; path: string }>;
      expect(ops.some(op => op.type === 'insert')).toBe(true);
    });

    it('returns unsupportedContent for invalid JSON', async () => {
      const r1 = await treeDiffHandler.compute(
        { contentA: 'not-json', contentB: '{}' },
        storage,
      );
      expect(r1.variant).toBe('unsupportedContent');

      const r2 = await treeDiffHandler.compute(
        { contentA: '{}', contentB: 'not-json' },
        storage,
      );
      expect(r2.variant).toBe('unsupportedContent');
    });

    it('handles primitives at root level', async () => {
      const result = await treeDiffHandler.compute(
        { contentA: JSON.stringify(42), contentB: JSON.stringify(99) },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.distance).toBe(1);
    });

    it('handles null values', async () => {
      const contentA = JSON.stringify({ x: null });
      const contentB = JSON.stringify({ x: 'value' });

      const result = await treeDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');
      expect(result.distance).toBeGreaterThan(0);
    });

    it('handles deeply nested changes', async () => {
      const contentA = JSON.stringify({ a: { b: { c: { d: 1 } } } });
      const contentB = JSON.stringify({ a: { b: { c: { d: 2 } } } });

      const result = await treeDiffHandler.compute({ contentA, contentB }, storage);
      expect(result.variant).toBe('ok');
      expect(result.distance).toBe(1);
    });
  });
});
