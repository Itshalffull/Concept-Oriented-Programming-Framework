// Provenance — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { provenanceHandler } from './handler.js';
import type { ProvenanceStorage } from './types.js';

const createTestStorage = (): ProvenanceStorage => {
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

const createFailingStorage = (): ProvenanceStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = provenanceHandler;

describe('Provenance handler', () => {
  describe('record', () => {
    it('should record a provenance entry and return ok with recordId', async () => {
      const storage = createTestStorage();
      const result = await handler.record(
        { entity: 'doc-1', activity: 'transform', agent: 'pipeline', inputs: 'raw-data' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.recordId).toContain('prov:doc-1');
      }
    });

    it('should maintain provenance chain for multiple records on same entity', async () => {
      const storage = createTestStorage();
      await handler.record(
        { entity: 'doc-1', activity: 'step1', agent: 'a1', inputs: 'i1' },
        storage,
      )();
      await handler.record(
        { entity: 'doc-1', activity: 'step2', agent: 'a2', inputs: 'i2' },
        storage,
      )();

      const chainRec = await storage.get('provenance_chain', 'doc-1');
      expect(chainRec).not.toBeNull();
      if (chainRec) {
        const ids = chainRec.ids as string[];
        expect(ids.length).toBe(2);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.record(
        { entity: 'doc-1', activity: 'a', agent: 'b', inputs: 'c' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('trace', () => {
    it('should return notfound for entity with no provenance', async () => {
      const storage = createTestStorage();
      const result = await handler.trace({ entityId: 'unknown' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return the chain string for a tracked entity', async () => {
      const storage = createTestStorage();
      await handler.record(
        { entity: 'doc-1', activity: 'create', agent: 'user', inputs: 'none' },
        storage,
      )();

      const result = await handler.trace({ entityId: 'doc-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.chain).toContain('prov:doc-1');
        }
      }
    });
  });

  describe('audit', () => {
    it('should return notfound for unknown batch', async () => {
      const storage = createTestStorage();
      const result = await handler.audit({ batchId: 'unknown-batch' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should audit using chain when batchId is an entity', async () => {
      const storage = createTestStorage();
      await handler.record(
        { entity: 'batch-entity', activity: 'process', agent: 'sys', inputs: 'raw' },
        storage,
      )();

      const result = await handler.audit({ batchId: 'batch-entity' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('rollback', () => {
    it('should return notfound for unknown batch', async () => {
      const storage = createTestStorage();
      const result = await handler.rollback({ batchId: 'unknown' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should rollback all records in a batch and return count', async () => {
      const storage = createTestStorage();
      await handler.record(
        { entity: 'rb-entity', activity: 's1', agent: 'a', inputs: 'i' },
        storage,
      )();
      await handler.record(
        { entity: 'rb-entity', activity: 's2', agent: 'a', inputs: 'i' },
        storage,
      )();

      const result = await handler.rollback({ batchId: 'rb-entity' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.rolled).toBe(2);
        }
      }
    });
  });

  describe('diff', () => {
    it('should return notfound for entity without provenance', async () => {
      const storage = createTestStorage();
      const result = await handler.diff(
        { entityId: 'unknown', version1: 'v1', version2: 'v2' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should diff two versions when entity has provenance', async () => {
      const storage = createTestStorage();
      const r1 = await handler.record(
        { entity: 'diff-ent', activity: 'create', agent: 'u', inputs: 'i1' },
        storage,
      )();
      const r2 = await handler.record(
        { entity: 'diff-ent', activity: 'update', agent: 'u', inputs: 'i2' },
        storage,
      )();

      expect(E.isRight(r1)).toBe(true);
      expect(E.isRight(r2)).toBe(true);
      if (!E.isRight(r1) || !E.isRight(r2)) return;

      const result = await handler.diff(
        { entityId: 'diff-ent', version1: r1.right.recordId, version2: r2.right.recordId },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.changes).toContain('fields differ');
        }
      }
    });
  });

  describe('reproduce', () => {
    it('should return notfound for entity without provenance', async () => {
      const storage = createTestStorage();
      const result = await handler.reproduce({ entityId: 'unknown' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should produce a reproducibility plan', async () => {
      const storage = createTestStorage();
      await handler.record(
        { entity: 'repro-ent', activity: 'extract', agent: 'pipeline', inputs: 'source.csv' },
        storage,
      )();
      await handler.record(
        { entity: 'repro-ent', activity: 'transform', agent: 'pipeline', inputs: 'extracted' },
        storage,
      )();

      const result = await handler.reproduce({ entityId: 'repro-ent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.plan).toContain('extract');
          expect(result.right.plan).toContain('transform');
        }
      }
    });
  });
});
