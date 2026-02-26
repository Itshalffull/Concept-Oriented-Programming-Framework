// Patch concept handler tests -- create, apply, invert, compose, and commute operations.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { patchHandler, resetPatchCounter } from '../implementations/typescript/patch.impl.js';

describe('Patch', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  // Helper: build a simple edit script that inserts a line
  function makeEditScript(ops: Array<{ type: string; line: number; content: string }>): string {
    return JSON.stringify(ops);
  }

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetPatchCounter();
  });

  describe('create', () => {
    it('creates a patch with a valid edit script', async () => {
      const effect = makeEditScript([
        { type: 'equal', line: 0, content: 'hello' },
        { type: 'insert', line: 1, content: 'world' },
      ]);

      const result = await patchHandler.create({ base: 'v1', target: 'v2', effect }, storage);
      expect(result.variant).toBe('ok');
      expect(result.patchId).toBe('patch-1');
    });

    it('rejects invalid JSON effect', async () => {
      const result = await patchHandler.create({ base: 'v1', target: 'v2', effect: 'not-json' }, storage);
      expect(result.variant).toBe('invalidEffect');
    });
  });

  describe('apply', () => {
    it('applies a patch to content', async () => {
      const effect = makeEditScript([
        { type: 'equal', line: 0, content: 'hello' },
        { type: 'insert', line: 1, content: 'world' },
      ]);

      const created = await patchHandler.create({ base: 'v1', target: 'v2', effect }, storage);
      const patchId = created.patchId as string;

      const result = await patchHandler.apply({ patchId, content: 'hello' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.result).toBe('hello\nworld');
    });

    it('returns notFound for unknown patch', async () => {
      const result = await patchHandler.apply({ patchId: 'nonexistent', content: 'hello' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('invert', () => {
    it('creates an inverse patch that swaps insert/delete', async () => {
      const effect = makeEditScript([
        { type: 'equal', line: 0, content: 'hello' },
        { type: 'insert', line: 1, content: 'added-line' },
      ]);

      const created = await patchHandler.create({ base: 'v1', target: 'v2', effect }, storage);
      const patchId = created.patchId as string;

      const inverted = await patchHandler.invert({ patchId }, storage);
      expect(inverted.variant).toBe('ok');
      expect(inverted.inversePatchId).toBeDefined();

      // The inverse should turn inserts into deletes
      const inversePatch = await storage.get('patch', inverted.inversePatchId as string);
      const inverseOps = JSON.parse(inversePatch!.effect as string);
      expect(inverseOps.some((op: { type: string }) => op.type === 'delete')).toBe(true);
    });

    it('returns notFound for unknown patch', async () => {
      const result = await patchHandler.invert({ patchId: 'nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });

    it('applying a patch then its inverse round-trips content', async () => {
      const effect = makeEditScript([
        { type: 'equal', line: 0, content: 'line1' },
        { type: 'delete', line: 1, content: 'line2' },
        { type: 'insert', line: 1, content: 'new-line2' },
      ]);

      const created = await patchHandler.create({ base: 'v1', target: 'v2', effect }, storage);
      const patchId = created.patchId as string;

      // Apply forward
      const applied = await patchHandler.apply({ patchId, content: 'line1\nline2' }, storage);
      expect(applied.variant).toBe('ok');
      expect(applied.result).toBe('line1\nnew-line2');

      // Apply inverse
      const inverted = await patchHandler.invert({ patchId }, storage);
      const reversed = await patchHandler.apply({
        patchId: inverted.inversePatchId as string,
        content: applied.result as string,
      }, storage);
      expect(reversed.variant).toBe('ok');
      expect(reversed.result).toBe('line1\nline2');
    });
  });

  describe('compose', () => {
    it('composes two sequential patches into one', async () => {
      const effect1 = makeEditScript([
        { type: 'equal', line: 0, content: 'hello' },
        { type: 'insert', line: 1, content: 'middle' },
      ]);
      const effect2 = makeEditScript([
        { type: 'equal', line: 0, content: 'hello' },
        { type: 'equal', line: 1, content: 'middle' },
        { type: 'insert', line: 2, content: 'end' },
      ]);

      const p1 = await patchHandler.create({ base: 'v1', target: 'v2', effect: effect1 }, storage);
      const p2 = await patchHandler.create({ base: 'v2', target: 'v3', effect: effect2 }, storage);

      const result = await patchHandler.compose(
        { first: p1.patchId as string, second: p2.patchId as string },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.composedId).toBeDefined();
    });

    it('rejects composition of non-sequential patches', async () => {
      const effect = makeEditScript([{ type: 'equal', line: 0, content: 'x' }]);
      const p1 = await patchHandler.create({ base: 'v1', target: 'v2', effect }, storage);
      const p2 = await patchHandler.create({ base: 'v3', target: 'v4', effect }, storage);

      const result = await patchHandler.compose(
        { first: p1.patchId as string, second: p2.patchId as string },
        storage,
      );
      expect(result.variant).toBe('nonSequential');
    });

    it('returns notFound for unknown patch', async () => {
      const result = await patchHandler.compose({ first: 'nonexistent', second: 'also-nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('commute', () => {
    it('commutes non-overlapping patches', async () => {
      // Two patches that affect different lines
      const effect1 = makeEditScript([
        { type: 'insert', line: 0, content: 'added-at-0' },
      ]);
      const effect2 = makeEditScript([
        { type: 'insert', line: 5, content: 'added-at-5' },
      ]);

      const p1 = await patchHandler.create({ base: 'v1', target: 'v2', effect: effect1 }, storage);
      const p2 = await patchHandler.create({ base: 'v1', target: 'v3', effect: effect2 }, storage);

      const result = await patchHandler.commute(
        { p1: p1.patchId as string, p2: p2.patchId as string },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.p1Prime).toBeDefined();
      expect(result.p2Prime).toBeDefined();
    });

    it('rejects commuting overlapping patches', async () => {
      const effect1 = makeEditScript([
        { type: 'insert', line: 0, content: 'first' },
      ]);
      const effect2 = makeEditScript([
        { type: 'delete', line: 0, content: 'first' },
      ]);

      const p1 = await patchHandler.create({ base: 'v1', target: 'v2', effect: effect1 }, storage);
      const p2 = await patchHandler.create({ base: 'v1', target: 'v3', effect: effect2 }, storage);

      const result = await patchHandler.commute(
        { p1: p1.patchId as string, p2: p2.patchId as string },
        storage,
      );
      expect(result.variant).toBe('cannotCommute');
    });

    it('returns notFound for unknown patch', async () => {
      const result = await patchHandler.commute({ p1: 'nonexistent', p2: 'also-nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });
});
