// ============================================================
// TestEntity Handler Tests
//
// Tests for test registration, retrieval, entity/action/kind
// queries, failure detection, coverage reporting, untested
// action/invariant discovery, and result recording.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { testEntityHandler } from '../handlers/ts/score/test-entity.handler.js';

describe('TestEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('register', () => {
    it('registers a new test', async () => {
      const result = await testEntityHandler.register(
        {
          name: 'Todo/create conformance',
          sourceFile: 'tests/todo.conformance.test.ts',
          kind: 'conformance',
          targetEntity: 'Todo',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.test).toBeDefined();
    });

    it('returns alreadyRegistered for duplicate name', async () => {
      await testEntityHandler.register(
        { name: 'Todo/create', sourceFile: 'test.ts', kind: 'unit', targetEntity: 'Todo' },
        storage,
      );
      const result = await testEntityHandler.register(
        { name: 'Todo/create', sourceFile: 'test2.ts', kind: 'unit', targetEntity: 'Todo' },
        storage,
      );
      expect(result.variant).toBe('alreadyRegistered');
    });
  });

  describe('get', () => {
    it('retrieves by name', async () => {
      const reg = await testEntityHandler.register(
        { name: 'Todo/create', sourceFile: 'test.ts', kind: 'unit', targetEntity: 'Todo' },
        storage,
      );
      const result = await testEntityHandler.get({ name: 'Todo/create' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.test).toBe(reg.test);
    });

    it('returns notfound for nonexistent', async () => {
      const result = await testEntityHandler.get({ name: 'nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  describe('findByEntity', () => {
    it('returns all tests targeting an entity', async () => {
      await testEntityHandler.register(
        { name: 'Todo/create', sourceFile: 'a.test.ts', kind: 'conformance', targetEntity: 'Todo' },
        storage,
      );
      await testEntityHandler.register(
        { name: 'Todo/delete', sourceFile: 'a.test.ts', kind: 'conformance', targetEntity: 'Todo' },
        storage,
      );
      await testEntityHandler.register(
        { name: 'User/signup', sourceFile: 'b.test.ts', kind: 'unit', targetEntity: 'User' },
        storage,
      );
      const result = await testEntityHandler.findByEntity({ entity: 'Todo' }, storage);
      expect(result.variant).toBe('ok');
      const tests = JSON.parse(result.tests as string);
      expect(tests).toHaveLength(2);
    });
  });

  describe('findByAction', () => {
    it('finds tests for a specific concept action', async () => {
      await testEntityHandler.register(
        { name: 'Todo/create conformance', sourceFile: 'a.test.ts', kind: 'conformance', targetEntity: 'Todo' },
        storage,
      );
      await testEntityHandler.register(
        { name: 'Todo/delete conformance', sourceFile: 'a.test.ts', kind: 'conformance', targetEntity: 'Todo' },
        storage,
      );
      const result = await testEntityHandler.findByAction(
        { concept: 'Todo', action: 'create' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const tests = JSON.parse(result.tests as string);
      expect(tests).toHaveLength(1);
    });
  });

  describe('findByKind', () => {
    it('returns all tests of a given kind', async () => {
      await testEntityHandler.register(
        { name: 'Todo/create', sourceFile: 'a.test.ts', kind: 'conformance', targetEntity: 'Todo' },
        storage,
      );
      await testEntityHandler.register(
        { name: 'User/signup', sourceFile: 'b.test.ts', kind: 'unit', targetEntity: 'User' },
        storage,
      );
      await testEntityHandler.register(
        { name: 'Todo/delete', sourceFile: 'c.test.ts', kind: 'conformance', targetEntity: 'Todo' },
        storage,
      );
      const result = await testEntityHandler.findByKind({ kind: 'conformance' }, storage);
      expect(result.variant).toBe('ok');
      const tests = JSON.parse(result.tests as string);
      expect(tests).toHaveLength(2);
    });
  });

  describe('findFailing', () => {
    it('returns allPassing when no tests have failed', async () => {
      await testEntityHandler.register(
        { name: 'Todo/create', sourceFile: 'a.test.ts', kind: 'unit', targetEntity: 'Todo' },
        storage,
      );
      const result = await testEntityHandler.findFailing({}, storage);
      expect(result.variant).toBe('allPassing');
    });

    it('returns failing tests', async () => {
      const reg = await testEntityHandler.register(
        { name: 'Todo/create', sourceFile: 'a.test.ts', kind: 'unit', targetEntity: 'Todo' },
        storage,
      );
      await testEntityHandler.recordResult(
        { test: reg.test, result: 'fail', duration: 100 },
        storage,
      );
      const result = await testEntityHandler.findFailing({}, storage);
      expect(result.variant).toBe('ok');
      const tests = JSON.parse(result.tests as string);
      expect(tests).toHaveLength(1);
      expect(tests[0].name).toBe('Todo/create');
    });

    it('includes error results as failing', async () => {
      const reg = await testEntityHandler.register(
        { name: 'Todo/create', sourceFile: 'a.test.ts', kind: 'unit', targetEntity: 'Todo' },
        storage,
      );
      await testEntityHandler.recordResult(
        { test: reg.test, result: 'error', duration: 50 },
        storage,
      );
      const result = await testEntityHandler.findFailing({}, storage);
      expect(result.variant).toBe('ok');
    });
  });

  describe('coverageReport', () => {
    it('returns coverage report for an entity', async () => {
      await testEntityHandler.register(
        { name: 'Todo/create', sourceFile: 'a.test.ts', kind: 'conformance', targetEntity: 'Todo' },
        storage,
      );
      const result = await testEntityHandler.coverageReport(
        { entity: 'Todo' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const report = JSON.parse(result.report as string);
      expect(report.testedActions).toBeGreaterThanOrEqual(0);
    });
  });

  describe('untestedActions', () => {
    it('returns fullCoverage (stub)', async () => {
      const result = await testEntityHandler.untestedActions({}, storage);
      expect(result.variant).toBe('fullCoverage');
    });
  });

  describe('untestedInvariants', () => {
    it('returns fullCoverage (stub)', async () => {
      const result = await testEntityHandler.untestedInvariants({}, storage);
      expect(result.variant).toBe('fullCoverage');
    });
  });

  describe('recordResult', () => {
    it('records a pass result', async () => {
      const reg = await testEntityHandler.register(
        { name: 'Todo/create', sourceFile: 'a.test.ts', kind: 'unit', targetEntity: 'Todo' },
        storage,
      );
      const result = await testEntityHandler.recordResult(
        { test: reg.test, result: 'pass', duration: 42 },
        storage,
      );
      expect(result.variant).toBe('ok');

      // Verify the result was stored
      const entry = (await storage.find('tests'))[0];
      expect(entry.lastResult).toBe('pass');
      expect(entry.lastDuration).toBe(42);
    });

    it('handles recording for nonexistent test gracefully', async () => {
      const result = await testEntityHandler.recordResult(
        { test: 'bad-id', result: 'pass', duration: 10 },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });
});
