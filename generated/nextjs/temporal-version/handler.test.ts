// TemporalVersion — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { temporalVersionHandler } from './handler.js';
import type { TemporalVersionStorage } from './types.js';

const createTestStorage = (): TemporalVersionStorage => {
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

const createFailingStorage = (): TemporalVersionStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('TemporalVersion handler', () => {
  describe('record', () => {
    it('should record a version with a valid hash', async () => {
      const storage = createTestStorage();

      const result = await temporalVersionHandler.record(
        {
          contentHash: 'abcdef01',
          validFrom: O.none,
          validTo: O.none,
          metadata: Buffer.from('{}'),
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.versionId).toContain('ver-abcdef01');
        }
      }
    });

    it('should return invalidHash for a non-hex hash', async () => {
      const storage = createTestStorage();

      const result = await temporalVersionHandler.record(
        {
          contentHash: 'not-a-hash!',
          validFrom: O.none,
          validTo: O.none,
          metadata: Buffer.from('{}'),
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidHash');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await temporalVersionHandler.record(
        {
          contentHash: 'abcdef01',
          validFrom: O.none,
          validTo: O.none,
          metadata: Buffer.from('{}'),
        },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('asOf', () => {
    it('should find a version matching time constraints', async () => {
      const storage = createTestStorage();
      const now = new Date().toISOString();
      await storage.put('temporal_versions', 'ver-1', {
        versionId: 'ver-1',
        contentHash: 'aaaa1111',
        validFrom: '2020-01-01T00:00:00.000Z',
        validTo: '9999-12-31T23:59:59.999Z',
        transactionFrom: '2020-01-01T00:00:00.000Z',
        transactionTo: '9999-12-31T23:59:59.999Z',
        superseded: false,
      });

      const result = await temporalVersionHandler.asOf(
        {
          systemTime: O.some('2025-01-01T00:00:00.000Z'),
          validTime: O.some('2025-01-01T00:00:00.000Z'),
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.versionId).toBe('ver-1');
        }
      }
    });

    it('should return notFound when no version matches', async () => {
      const storage = createTestStorage();

      const result = await temporalVersionHandler.asOf(
        { systemTime: O.none, validTime: O.none },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });
  });

  describe('between', () => {
    it('should return versions within a valid-time range', async () => {
      const storage = createTestStorage();
      await storage.put('temporal_versions', 'ver-1', {
        versionId: 'ver-1',
        validFrom: '2025-01-15T00:00:00.000Z',
        transactionFrom: '2025-01-10T00:00:00.000Z',
      });

      const result = await temporalVersionHandler.between(
        { start: '2025-01-01T00:00:00.000Z', end: '2025-02-01T00:00:00.000Z', dimension: 'valid' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.versions).toContain('ver-1');
        }
      }
    });

    it('should return invalidDimension for an unknown dimension', async () => {
      const storage = createTestStorage();

      const result = await temporalVersionHandler.between(
        { start: '2025-01-01', end: '2025-02-01', dimension: 'spatial' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidDimension');
      }
    });
  });

  describe('current', () => {
    it('should return the latest version', async () => {
      const storage = createTestStorage();
      await storage.put('temporal_current', 'latest', {
        versionId: 'ver-99',
        contentHash: 'ffff0000',
      });

      const result = await temporalVersionHandler.current({}, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.versionId).toBe('ver-99');
        }
      }
    });

    it('should return empty when no versions are recorded', async () => {
      const storage = createTestStorage();

      const result = await temporalVersionHandler.current({}, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('empty');
      }
    });
  });

  describe('supersede', () => {
    it('should supersede an existing version', async () => {
      const storage = createTestStorage();
      await storage.put('temporal_versions', 'ver-old', {
        versionId: 'ver-old',
        contentHash: 'aaaa1111',
        validFrom: '2020-01-01T00:00:00.000Z',
        validTo: '9999-12-31T23:59:59.999Z',
        superseded: false,
      });

      const result = await temporalVersionHandler.supersede(
        { versionId: 'ver-old', contentHash: 'bbbb2222' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.newVersionId).toContain('ver-bbbb2222');
        }
      }
    });

    it('should return notFound for a missing version', async () => {
      const storage = createTestStorage();

      const result = await temporalVersionHandler.supersede(
        { versionId: 'missing', contentHash: 'bbbb2222' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });
  });
});
