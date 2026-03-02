// RetentionPolicy — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { retentionPolicyHandler } from './handler.js';
import type { RetentionPolicyStorage } from './types.js';

const createTestStorage = (): RetentionPolicyStorage => {
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

const createFailingStorage = (): RetentionPolicyStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = retentionPolicyHandler;

describe('RetentionPolicy handler', () => {
  describe('setRetention', () => {
    it('should create a new retention policy', async () => {
      const storage = createTestStorage();
      const result = await handler.setRetention(
        { recordType: 'email', period: 7, unit: 'years', dispositionAction: 'archive' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.policyId).toBe('rp:email');
        }
      }
    });

    it('should return alreadyExists when policy exists', async () => {
      const storage = createTestStorage();
      await handler.setRetention({ recordType: 'email', period: 7, unit: 'years', dispositionAction: 'archive' }, storage)();
      const result = await handler.setRetention({ recordType: 'email', period: 5, unit: 'years', dispositionAction: 'delete' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyExists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.setRetention({ recordType: 'x', period: 1, unit: 'days', dispositionAction: 'delete' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('applyHold', () => {
    it('should apply a hold and return holdId', async () => {
      const storage = createTestStorage();
      const result = await handler.applyHold(
        { name: 'litigation-2026', scope: '*', reason: 'Active litigation', issuer: 'legal' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.holdId).toBeTruthy();
      }
    });
  });

  describe('releaseHold', () => {
    it('should release an active hold', async () => {
      const storage = createTestStorage();
      const applyResult = await handler.applyHold(
        { name: 'hold1', scope: '*', reason: 'test', issuer: 'admin' },
        storage,
      )();
      expect(E.isRight(applyResult)).toBe(true);
      const holdId = E.isRight(applyResult) ? applyResult.right.holdId : '';
      const result = await handler.releaseHold({ holdId, releasedBy: 'admin', reason: 'resolved' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notFound for non-existent hold', async () => {
      const storage = createTestStorage();
      const result = await handler.releaseHold({ holdId: 'fake-hold', releasedBy: 'admin', reason: 'test' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return alreadyReleased for inactive hold', async () => {
      const storage = createTestStorage();
      const applyResult = await handler.applyHold(
        { name: 'hold2', scope: '*', reason: 'test', issuer: 'admin' },
        storage,
      )();
      const holdId = E.isRight(applyResult) ? applyResult.right.holdId : '';
      await handler.releaseHold({ holdId, releasedBy: 'admin', reason: 'done' }, storage)();
      const result = await handler.releaseHold({ holdId, releasedBy: 'admin', reason: 'again' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyReleased');
      }
    });
  });

  describe('checkDisposition', () => {
    it('should return held when active holds cover the record', async () => {
      const storage = createTestStorage();
      await handler.applyHold({ name: 'global-hold', scope: '*', reason: 'test', issuer: 'admin' }, storage)();
      const result = await handler.checkDisposition({ record: 'some-record' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('held');
      }
    });

    it('should return disposable when no holds or active retention', async () => {
      const storage = createTestStorage();
      const result = await handler.checkDisposition({ record: 'free-record' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('disposable');
      }
    });
  });

  describe('dispose', () => {
    it('should dispose a record when no holds exist', async () => {
      const storage = createTestStorage();
      const result = await handler.dispose({ record: 'old-record', disposedBy: 'system' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return held when active holds block disposal', async () => {
      const storage = createTestStorage();
      await handler.applyHold({ name: 'block-hold', scope: '*', reason: 'test', issuer: 'admin' }, storage)();
      const result = await handler.dispose({ record: 'blocked-record', disposedBy: 'system' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('held');
      }
    });
  });

  describe('auditLog', () => {
    it('should return disposal entries after dispose', async () => {
      const storage = createTestStorage();
      await handler.dispose({ record: 'rec-1', disposedBy: 'admin' }, storage)();
      const result = await handler.auditLog({ record: O.none }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.entries.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should filter audit log by record name', async () => {
      const storage = createTestStorage();
      await handler.dispose({ record: 'rec-a', disposedBy: 'admin' }, storage)();
      await handler.dispose({ record: 'rec-b', disposedBy: 'admin' }, storage)();
      const result = await handler.auditLog({ record: O.some('rec-a') }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.entries.every(e => e.record === 'rec-a')).toBe(true);
      }
    });

    it('should return empty entries when no disposals occurred', async () => {
      const storage = createTestStorage();
      const result = await handler.auditLog({ record: O.none }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.entries.length).toBe(0);
      }
    });
  });
});
