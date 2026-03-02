// FlakyTest — handler.test.ts
// Unit tests for flakyTest handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { flakyTestHandler } from './handler.js';
import type { FlakyTestStorage } from './types.js';

const createTestStorage = (): FlakyTestStorage => {
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

const createFailingStorage = (): FlakyTestStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('FlakyTest handler', () => {
  describe('record', () => {
    it('should record a test result and return ok when not flaky', async () => {
      const storage = createTestStorage();
      const result = await flakyTestHandler.record(
        { testId: 't1', language: 'ts', builder: 'vitest', testType: 'unit', passed: true, duration: 100 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should detect flaky tests when flip count exceeds threshold', async () => {
      const storage = createTestStorage();
      const input = { testId: 't1', language: 'ts', builder: 'vitest', testType: 'unit', duration: 50 };
      // Alternate pass/fail to create flips
      await flakyTestHandler.record({ ...input, passed: true }, storage)();
      await flakyTestHandler.record({ ...input, passed: false }, storage)();
      await flakyTestHandler.record({ ...input, passed: true }, storage)();
      await flakyTestHandler.record({ ...input, passed: false }, storage)();
      const result = await flakyTestHandler.record({ ...input, passed: true }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        // After 5 records with alternating results, flipCount should be 4 (>= threshold of 3)
        expect(result.right.variant).toBe('flakyDetected');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await flakyTestHandler.record(
        { testId: 't1', language: 'ts', builder: 'vitest', testType: 'unit', passed: true, duration: 100 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('quarantine', () => {
    it('should quarantine a recorded test', async () => {
      const storage = createTestStorage();
      await flakyTestHandler.record(
        { testId: 't1', language: 'ts', builder: 'vitest', testType: 'unit', passed: true, duration: 50 },
        storage,
      )();
      const result = await flakyTestHandler.quarantine(
        { testId: 't1', reason: 'too flaky', owner: O.some('dev-a') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return alreadyQuarantined for double quarantine', async () => {
      const storage = createTestStorage();
      await flakyTestHandler.record(
        { testId: 't1', language: 'ts', builder: 'vitest', testType: 'unit', passed: true, duration: 50 },
        storage,
      )();
      await flakyTestHandler.quarantine(
        { testId: 't1', reason: 'flaky', owner: O.none },
        storage,
      )();
      const result = await flakyTestHandler.quarantine(
        { testId: 't1', reason: 'still flaky', owner: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyQuarantined');
      }
    });

    it('should return notFound for unknown test', async () => {
      const storage = createTestStorage();
      const result = await flakyTestHandler.quarantine(
        { testId: 'unknown', reason: 'test', owner: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await flakyTestHandler.quarantine(
        { testId: 't1', reason: 'test', owner: O.none },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('release', () => {
    it('should release a quarantined test', async () => {
      const storage = createTestStorage();
      await flakyTestHandler.record(
        { testId: 't1', language: 'ts', builder: 'vitest', testType: 'unit', passed: true, duration: 50 },
        storage,
      )();
      await flakyTestHandler.quarantine(
        { testId: 't1', reason: 'flaky', owner: O.none },
        storage,
      )();
      const result = await flakyTestHandler.release({ testId: 't1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notQuarantined for non-quarantined test', async () => {
      const storage = createTestStorage();
      await flakyTestHandler.record(
        { testId: 't1', language: 'ts', builder: 'vitest', testType: 'unit', passed: true, duration: 50 },
        storage,
      )();
      const result = await flakyTestHandler.release({ testId: 't1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notQuarantined');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await flakyTestHandler.release({ testId: 't1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('isQuarantined', () => {
    it('should return yes for quarantined test', async () => {
      const storage = createTestStorage();
      await flakyTestHandler.record(
        { testId: 't1', language: 'ts', builder: 'vitest', testType: 'unit', passed: true, duration: 50 },
        storage,
      )();
      await flakyTestHandler.quarantine(
        { testId: 't1', reason: 'flaky', owner: O.some('dev-a') },
        storage,
      )();
      const result = await flakyTestHandler.isQuarantined({ testId: 't1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('yes');
      }
    });

    it('should return no for non-quarantined test', async () => {
      const storage = createTestStorage();
      await flakyTestHandler.record(
        { testId: 't1', language: 'ts', builder: 'vitest', testType: 'unit', passed: true, duration: 50 },
        storage,
      )();
      const result = await flakyTestHandler.isQuarantined({ testId: 't1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('no');
      }
    });

    it('should return unknown for unrecorded test', async () => {
      const storage = createTestStorage();
      const result = await flakyTestHandler.isQuarantined({ testId: 'nope' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unknown');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await flakyTestHandler.isQuarantined({ testId: 't1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('report', () => {
    it('should return a summary report', async () => {
      const storage = createTestStorage();
      await flakyTestHandler.record(
        { testId: 't1', language: 'ts', builder: 'vitest', testType: 'unit', passed: true, duration: 50 },
        storage,
      )();
      const result = await flakyTestHandler.report({ testType: O.none }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.summary.totalTracked).toBeGreaterThanOrEqual(1);
      }
    });

    it('should filter by testType when provided', async () => {
      const storage = createTestStorage();
      await flakyTestHandler.record(
        { testId: 't1', language: 'ts', builder: 'vitest', testType: 'unit', passed: true, duration: 50 },
        storage,
      )();
      await flakyTestHandler.record(
        { testId: 't2', language: 'ts', builder: 'vitest', testType: 'integration', passed: true, duration: 100 },
        storage,
      )();
      const result = await flakyTestHandler.report({ testType: O.some('unit') }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.summary.totalTracked).toBe(1);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await flakyTestHandler.report({ testType: O.none }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setPolicy', () => {
    it('should store a policy configuration', async () => {
      const storage = createTestStorage();
      const result = await flakyTestHandler.setPolicy(
        { flipThreshold: O.some(5), flipWindow: O.some('48h'), autoQuarantine: O.some(true), retryCount: O.some(2) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should merge with existing policy defaults', async () => {
      const storage = createTestStorage();
      await flakyTestHandler.setPolicy(
        { flipThreshold: O.some(5), flipWindow: O.none, autoQuarantine: O.none, retryCount: O.none },
        storage,
      )();
      const result = await flakyTestHandler.setPolicy(
        { flipThreshold: O.none, flipWindow: O.some('12h'), autoQuarantine: O.none, retryCount: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await flakyTestHandler.setPolicy(
        { flipThreshold: O.some(5), flipWindow: O.none, autoQuarantine: O.none, retryCount: O.none },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
