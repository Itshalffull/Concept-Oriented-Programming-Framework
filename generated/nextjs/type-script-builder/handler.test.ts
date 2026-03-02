// TypeScriptBuilder — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { typeScriptBuilderHandler } from './handler.js';
import type { TypeScriptBuilderStorage } from './types.js';

const createTestStorage = (): TypeScriptBuilderStorage => {
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

const createFailingStorage = (): TypeScriptBuilderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = typeScriptBuilderHandler;

describe('TypeScriptBuilder handler', () => {
  describe('build', () => {
    it('should build successfully with no diagnostics', async () => {
      const storage = createTestStorage();
      const result = await handler.build(
        {
          source: 'src/app.ts',
          toolchainPath: '/usr/local/bin/tsc',
          platform: 'node',
          config: { mode: 'development', features: O.none },
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.build).toContain('tsbuild-');
          expect(result.right.artifactPath).toContain('dist/node/');
          expect(result.right.artifactHash).toBeTruthy();
        }
      }
    });

    it('should report type errors when diagnostics exist', async () => {
      const storage = createTestStorage();
      // Pre-populate diagnostics
      await storage.put('ts-diagnostics', 'error-1', {
        source: 'src/app.ts',
        severity: 'error',
        file: 'src/app.ts',
        line: 10,
        message: 'Type error: cannot assign string to number',
      });

      const result = await handler.build(
        {
          source: 'src/app.ts',
          toolchainPath: '/usr/local/bin/tsc',
          platform: 'node',
          config: { mode: 'development', features: O.none },
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('typeError');
        if (result.right.variant === 'typeError') {
          expect(result.right.errors.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.build(
        {
          source: 'src/app.ts',
          toolchainPath: '/usr/local/bin/tsc',
          platform: 'node',
          config: { mode: 'development', features: O.none },
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('test', () => {
    it('should return test failure when build not found', async () => {
      const storage = createTestStorage();
      const result = await handler.test(
        {
          build: 'nonexistent-build',
          toolchainPath: '/usr/local/bin/tsc',
          invocation: O.none,
          testType: O.none,
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('testFailure');
        if (result.right.variant === 'testFailure') {
          expect(result.right.failures[0].message).toContain('not found');
        }
      }
    });

    it('should report ok when build exists with no failing results', async () => {
      const storage = createTestStorage();
      // Create a build first
      await storage.put('builds', 'my-build', {
        buildId: 'my-build',
        source: 'src/app.ts',
        status: 'completed',
      });

      const result = await handler.test(
        {
          build: 'my-build',
          toolchainPath: '/usr/local/bin/tsc',
          invocation: O.none,
          testType: O.some('unit'),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.testType).toBe('unit');
        }
      }
    });

    it('should default to unit test type when not provided', async () => {
      const storage = createTestStorage();
      await storage.put('builds', 'my-build', {
        buildId: 'my-build',
        source: 'src/app.ts',
        status: 'completed',
      });

      const result = await handler.test(
        {
          build: 'my-build',
          toolchainPath: '/usr/local/bin/tsc',
          invocation: O.none,
          testType: O.none,
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.testType).toBe('unit');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.test(
        {
          build: 'my-build',
          toolchainPath: '/usr/local/bin/tsc',
          invocation: O.none,
          testType: O.none,
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('package', () => {
    it('should return formatUnsupported for unsupported format', async () => {
      const storage = createTestStorage();
      const result = await handler.package(
        { build: 'my-build', format: 'amd' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('formatUnsupported');
      }
    });

    it('should package successfully for esm format', async () => {
      const storage = createTestStorage();
      await storage.put('builds', 'my-build', {
        buildId: 'my-build',
        source: 'src/app.ts',
        status: 'completed',
      });

      const result = await handler.package(
        { build: 'my-build', format: 'esm' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.artifactPath).toContain('.mjs');
        }
      }
    });

    it('should package successfully for cjs format', async () => {
      const storage = createTestStorage();
      await storage.put('builds', 'my-build', {
        buildId: 'my-build',
        source: 'src/app.ts',
        status: 'completed',
      });

      const result = await handler.package(
        { build: 'my-build', format: 'cjs' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.artifactPath).toContain('.cjs');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.package(
        { build: 'my-build', format: 'esm' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('register', () => {
    it('should return registration metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('typescript-builder');
        expect(result.right.language).toBe('typescript');
        expect(result.right.capabilities).toContain('compile');
        expect(result.right.capabilities).toContain('type-check');
        expect(result.right.capabilities).toContain('bundle');
      }
    });
  });
});
