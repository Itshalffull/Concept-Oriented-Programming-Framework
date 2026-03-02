// KindSystem — handler.test.ts
// Unit tests for kindSystem handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { kindSystemHandler } from './handler.js';
import type { KindSystemStorage } from './types.js';

const createTestStorage = (): KindSystemStorage => {
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

const createFailingStorage = (): KindSystemStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('KindSystem handler', () => {
  describe('define', () => {
    it('should define a new kind', async () => {
      const storage = createTestStorage();
      const input = { name: 'concept-ast', category: 'ir' };

      const result = await kindSystemHandler.define(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.kind).toBe('concept-ast');
        }
      }
    });

    it('should return exists for duplicate kind', async () => {
      const storage = createTestStorage();
      await kindSystemHandler.define({ name: 'dup', category: 'ir' }, storage)();

      const result = await kindSystemHandler.define({ name: 'dup', category: 'ir' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await kindSystemHandler.define({ name: 'x', category: 'y' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('connect', () => {
    it('should connect two existing kinds', async () => {
      const storage = createTestStorage();
      await kindSystemHandler.define({ name: 'source', category: 'ir' }, storage)();
      await kindSystemHandler.define({ name: 'target', category: 'output' }, storage)();

      const result = await kindSystemHandler.connect({
        from: 'source',
        to: 'target',
        relation: 'transforms-to',
        transformName: O.some('codegen'),
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid when from kind does not exist', async () => {
      const storage = createTestStorage();
      await kindSystemHandler.define({ name: 'target', category: 'ir' }, storage)();

      const result = await kindSystemHandler.connect({
        from: 'missing', to: 'target', relation: 'r', transformName: O.none,
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid when to kind does not exist', async () => {
      const storage = createTestStorage();
      await kindSystemHandler.define({ name: 'source', category: 'ir' }, storage)();

      const result = await kindSystemHandler.connect({
        from: 'source', to: 'missing', relation: 'r', transformName: O.none,
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await kindSystemHandler.connect({
        from: 'a', to: 'b', relation: 'r', transformName: O.none,
      }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('route', () => {
    it('should find a direct route between connected kinds', async () => {
      const storage = createTestStorage();
      await kindSystemHandler.define({ name: 'A', category: 'ir' }, storage)();
      await kindSystemHandler.define({ name: 'B', category: 'ir' }, storage)();
      await kindSystemHandler.connect({
        from: 'A', to: 'B', relation: 'generates', transformName: O.some('gen'),
      }, storage)();

      const result = await kindSystemHandler.route({ from: 'A', to: 'B' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.path).toHaveLength(1);
          expect(result.right.path[0].kind).toBe('B');
        }
      }
    });

    it('should find a multi-hop route', async () => {
      const storage = createTestStorage();
      await kindSystemHandler.define({ name: 'X', category: 'ir' }, storage)();
      await kindSystemHandler.define({ name: 'Y', category: 'ir' }, storage)();
      await kindSystemHandler.define({ name: 'Z', category: 'output' }, storage)();
      await kindSystemHandler.connect({
        from: 'X', to: 'Y', relation: 'step1', transformName: O.none,
      }, storage)();
      await kindSystemHandler.connect({
        from: 'Y', to: 'Z', relation: 'step2', transformName: O.none,
      }, storage)();

      const result = await kindSystemHandler.route({ from: 'X', to: 'Z' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.path).toHaveLength(2);
        }
      }
    });

    it('should return unreachable when no route exists', async () => {
      const storage = createTestStorage();
      await kindSystemHandler.define({ name: 'island', category: 'ir' }, storage)();

      const result = await kindSystemHandler.route({
        from: 'island', to: 'nowhere',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unreachable');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await kindSystemHandler.route({ from: 'a', to: 'b' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate a valid pipeline', async () => {
      const storage = createTestStorage();
      await kindSystemHandler.define({ name: 'p1', category: 'ir' }, storage)();
      await kindSystemHandler.define({ name: 'p2', category: 'output' }, storage)();
      await kindSystemHandler.connect({
        from: 'p1', to: 'p2', relation: 'r', transformName: O.none,
      }, storage)();

      const result = await kindSystemHandler.validate({ from: 'p1', to: 'p2' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid for undefined kind', async () => {
      const storage = createTestStorage();
      const result = await kindSystemHandler.validate({
        from: 'undef', to: 'also-undef',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });
  });

  describe('dependents', () => {
    it('should find downstream dependents', async () => {
      const storage = createTestStorage();
      await kindSystemHandler.define({ name: 'd1', category: 'ir' }, storage)();
      await kindSystemHandler.define({ name: 'd2', category: 'ir' }, storage)();
      await kindSystemHandler.define({ name: 'd3', category: 'output' }, storage)();
      await kindSystemHandler.connect({
        from: 'd1', to: 'd2', relation: 'r', transformName: O.none,
      }, storage)();
      await kindSystemHandler.connect({
        from: 'd2', to: 'd3', relation: 'r', transformName: O.none,
      }, storage)();

      const result = await kindSystemHandler.dependents({ kind: 'd1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.downstream).toContain('d2');
        expect(result.right.downstream).toContain('d3');
      }
    });

    it('should return empty for a leaf kind', async () => {
      const storage = createTestStorage();
      await kindSystemHandler.define({ name: 'leaf', category: 'output' }, storage)();

      const result = await kindSystemHandler.dependents({ kind: 'leaf' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.downstream).toHaveLength(0);
      }
    });
  });

  describe('producers', () => {
    it('should find producers of a kind', async () => {
      const storage = createTestStorage();
      await kindSystemHandler.define({ name: 'src', category: 'ir' }, storage)();
      await kindSystemHandler.define({ name: 'tgt', category: 'ir' }, storage)();
      await kindSystemHandler.connect({
        from: 'src', to: 'tgt', relation: 'produces', transformName: O.some('gen'),
      }, storage)();

      const result = await kindSystemHandler.producers({ kind: 'tgt' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.transforms.length).toBeGreaterThan(0);
        expect(result.right.transforms[0].fromKind).toBe('src');
      }
    });
  });

  describe('consumers', () => {
    it('should find consumers of a kind', async () => {
      const storage = createTestStorage();
      await kindSystemHandler.define({ name: 'csrc', category: 'ir' }, storage)();
      await kindSystemHandler.define({ name: 'ctgt', category: 'output' }, storage)();
      await kindSystemHandler.connect({
        from: 'csrc', to: 'ctgt', relation: 'consumes', transformName: O.none,
      }, storage)();

      const result = await kindSystemHandler.consumers({ kind: 'csrc' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.transforms.length).toBeGreaterThan(0);
        expect(result.right.transforms[0].toKind).toBe('ctgt');
      }
    });
  });

  describe('graph', () => {
    it('should return the full kind graph', async () => {
      const storage = createTestStorage();
      await kindSystemHandler.define({ name: 'g1', category: 'ir' }, storage)();
      await kindSystemHandler.define({ name: 'g2', category: 'output' }, storage)();
      await kindSystemHandler.connect({
        from: 'g1', to: 'g2', relation: 'r', transformName: O.none,
      }, storage)();

      const result = await kindSystemHandler.graph({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.kinds.length).toBeGreaterThanOrEqual(2);
        expect(result.right.edges.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await kindSystemHandler.graph({}, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
