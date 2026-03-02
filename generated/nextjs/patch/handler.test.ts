// Patch — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { patchHandler } from './handler.js';
import type { PatchStorage } from './types.js';

const createTestStorage = (): PatchStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
};

const createFailingStorage = (): PatchStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const makeEffect = (ops: { op: string; line: string }[]): Buffer =>
  Buffer.from(JSON.stringify(ops), 'utf-8');

describe('Patch handler', () => {
  describe('create', () => {
    it('should create a patch from a valid edit script', async () => {
      const storage = createTestStorage();
      const effect = makeEffect([
        { op: 'keep', line: 'hello' },
        { op: 'delete', line: 'old' },
        { op: 'insert', line: 'new' },
      ]);

      const result = await patchHandler.create(
        { base: 'hash-a', target: 'hash-b', effect },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.patchId).toContain('patch_');
        }
      }
    });

    it('should return invalidEffect for non-JSON effect', async () => {
      const storage = createTestStorage();
      const effect = Buffer.from('not json', 'utf-8');

      const result = await patchHandler.create(
        { base: 'a', target: 'b', effect },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidEffect');
      }
    });

    it('should return invalidEffect for bad operation type', async () => {
      const storage = createTestStorage();
      const effect = makeEffect([{ op: 'bogus', line: 'x' }]);

      const result = await patchHandler.create(
        { base: 'a', target: 'b', effect },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidEffect');
      }
    });
  });

  describe('apply', () => {
    it('should apply a patch to matching content', async () => {
      const storage = createTestStorage();
      const effect = makeEffect([
        { op: 'keep', line: 'line1' },
        { op: 'delete', line: 'line2' },
        { op: 'insert', line: 'line2-new' },
      ]);

      const createResult = await patchHandler.create(
        { base: 'a', target: 'b', effect },
        storage,
      )();

      expect(E.isRight(createResult)).toBe(true);
      if (E.isRight(createResult) && createResult.right.variant === 'ok') {
        const content = Buffer.from('line1\nline2', 'utf-8');
        const applyResult = await patchHandler.apply(
          { patchId: createResult.right.patchId, content },
          storage,
        )();

        expect(E.isRight(applyResult)).toBe(true);
        if (E.isRight(applyResult) && applyResult.right.variant === 'ok') {
          expect(applyResult.right.result.toString('utf-8')).toBe('line1\nline2-new');
        }
      }
    });

    it('should return notFound for nonexistent patch', async () => {
      const storage = createTestStorage();
      const content = Buffer.from('hello', 'utf-8');

      const result = await patchHandler.apply(
        { patchId: 'nonexistent', content },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return incompatibleContext when content does not match', async () => {
      const storage = createTestStorage();
      const effect = makeEffect([{ op: 'keep', line: 'expected' }]);

      const createResult = await patchHandler.create(
        { base: 'a', target: 'b', effect },
        storage,
      )();

      expect(E.isRight(createResult)).toBe(true);
      if (E.isRight(createResult) && createResult.right.variant === 'ok') {
        const content = Buffer.from('different', 'utf-8');
        const applyResult = await patchHandler.apply(
          { patchId: createResult.right.patchId, content },
          storage,
        )();

        expect(E.isRight(applyResult)).toBe(true);
        if (E.isRight(applyResult)) {
          expect(applyResult.right.variant).toBe('incompatibleContext');
        }
      }
    });
  });

  describe('invert', () => {
    it('should create an inverted patch', async () => {
      const storage = createTestStorage();
      const effect = makeEffect([
        { op: 'delete', line: 'old' },
        { op: 'insert', line: 'new' },
      ]);

      const createResult = await patchHandler.create(
        { base: 'a', target: 'b', effect },
        storage,
      )();

      expect(E.isRight(createResult)).toBe(true);
      if (E.isRight(createResult) && createResult.right.variant === 'ok') {
        const invertResult = await patchHandler.invert(
          { patchId: createResult.right.patchId },
          storage,
        )();

        expect(E.isRight(invertResult)).toBe(true);
        if (E.isRight(invertResult) && invertResult.right.variant === 'ok') {
          expect(invertResult.right.inversePatchId).toContain('patch_');
        }
      }
    });

    it('should return notFound for nonexistent patch', async () => {
      const storage = createTestStorage();

      const result = await patchHandler.invert(
        { patchId: 'missing' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });
  });

  describe('compose', () => {
    it('should compose two sequential patches', async () => {
      const storage = createTestStorage();
      const effect1 = makeEffect([{ op: 'keep', line: 'a' }]);
      const effect2 = makeEffect([{ op: 'keep', line: 'a' }]);

      const r1 = await patchHandler.create({ base: 'v1', target: 'v2', effect: effect1 }, storage)();
      const r2 = await patchHandler.create({ base: 'v2', target: 'v3', effect: effect2 }, storage)();

      expect(E.isRight(r1)).toBe(true);
      expect(E.isRight(r2)).toBe(true);

      if (E.isRight(r1) && r1.right.variant === 'ok' && E.isRight(r2) && r2.right.variant === 'ok') {
        const result = await patchHandler.compose(
          { first: r1.right.patchId, second: r2.right.patchId },
          storage,
        )();

        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should return nonSequential when patches are not sequential', async () => {
      const storage = createTestStorage();
      const effect1 = makeEffect([{ op: 'keep', line: 'a' }]);
      const effect2 = makeEffect([{ op: 'keep', line: 'b' }]);

      const r1 = await patchHandler.create({ base: 'v1', target: 'v2', effect: effect1 }, storage)();
      const r2 = await patchHandler.create({ base: 'v5', target: 'v6', effect: effect2 }, storage)();

      if (E.isRight(r1) && r1.right.variant === 'ok' && E.isRight(r2) && r2.right.variant === 'ok') {
        const result = await patchHandler.compose(
          { first: r1.right.patchId, second: r2.right.patchId },
          storage,
        )();

        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('nonSequential');
        }
      }
    });

    it('should return notFound when first patch missing', async () => {
      const storage = createTestStorage();

      const result = await patchHandler.compose(
        { first: 'missing1', second: 'missing2' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });
  });

  describe('commute', () => {
    it('should commute non-overlapping patches', async () => {
      const storage = createTestStorage();
      const effect1 = makeEffect([
        { op: 'keep', line: 'a' },
        { op: 'keep', line: 'b' },
        { op: 'insert', line: 'c' },
      ]);
      const effect2 = makeEffect([
        { op: 'insert', line: 'x' },
        { op: 'keep', line: 'a' },
        { op: 'keep', line: 'b' },
      ]);

      const r1 = await patchHandler.create({ base: 'v1', target: 'v2', effect: effect1 }, storage)();
      const r2 = await patchHandler.create({ base: 'v1', target: 'v3', effect: effect2 }, storage)();

      if (E.isRight(r1) && r1.right.variant === 'ok' && E.isRight(r2) && r2.right.variant === 'ok') {
        const result = await patchHandler.commute(
          { p1: r1.right.patchId, p2: r2.right.patchId },
          storage,
        )();

        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should return cannotCommute for overlapping patches', async () => {
      const storage = createTestStorage();
      const effect1 = makeEffect([
        { op: 'delete', line: 'a' },
        { op: 'insert', line: 'b' },
      ]);
      const effect2 = makeEffect([
        { op: 'delete', line: 'a' },
        { op: 'insert', line: 'c' },
      ]);

      const r1 = await patchHandler.create({ base: 'v1', target: 'v2', effect: effect1 }, storage)();
      const r2 = await patchHandler.create({ base: 'v1', target: 'v3', effect: effect2 }, storage)();

      if (E.isRight(r1) && r1.right.variant === 'ok' && E.isRight(r2) && r2.right.variant === 'ok') {
        const result = await patchHandler.commute(
          { p1: r1.right.patchId, p2: r2.right.patchId },
          storage,
        )();

        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('cannotCommute');
        }
      }
    });

    it('should return notFound for missing patch', async () => {
      const storage = createTestStorage();

      const result = await patchHandler.commute(
        { p1: 'missing', p2: 'also-missing' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });
  });
});
