// SwiftBuilder — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { swiftBuilderHandler } from './handler.js';
import type { SwiftBuilderStorage } from './types.js';

const createTestStorage = (): SwiftBuilderStorage => {
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

const createFailingStorage = (): SwiftBuilderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = swiftBuilderHandler;

describe('SwiftBuilder handler', () => {
  describe('build', () => {
    it('should produce a successful build when no diagnostics or link errors exist', async () => {
      const storage = createTestStorage();
      const result = await handler.build(
        {
          source: 'Sources/MyApp/main.swift',
          toolchainPath: '/usr/bin/swiftc',
          platform: 'macos',
          config: { mode: 'debug', features: O.none },
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.artifactPath).toContain('.build/debug/');
          expect(result.right.artifactHash).toMatch(/^sha256-/);
        }
      }
    });

    it('should return compilationError when diagnostics exist', async () => {
      const storage = createTestStorage();
      await storage.put('swift-diagnostics', 'err1', {
        source: 'main.swift',
        severity: 'error',
        file: 'main.swift',
        line: 10,
        message: 'Syntax error',
      });
      const result = await handler.build(
        {
          source: 'main.swift',
          toolchainPath: '/usr/bin/swiftc',
          platform: 'macos',
          config: { mode: 'debug', features: O.none },
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('compilationError');
      }
    });

    it('should return linkerError when unresolved link deps exist', async () => {
      const storage = createTestStorage();
      await storage.put('swift-link-deps', 'dep1', {
        source: 'main.swift',
        name: 'libFoo',
        resolved: false,
      });
      const result = await handler.build(
        {
          source: 'main.swift',
          toolchainPath: '/usr/bin/swiftc',
          platform: 'macos',
          config: { mode: 'release', features: O.none },
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('linkerError');
        if (result.right.variant === 'linkerError') {
          expect(result.right.reason).toContain('libFoo');
        }
      }
    });

    it('should persist build record to storage', async () => {
      const storage = createTestStorage();
      const result = await handler.build(
        {
          source: 'main.swift',
          toolchainPath: '/usr/bin/swiftc',
          platform: 'macos',
          config: { mode: 'debug', features: O.none },
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const stored = await storage.get('builds', result.right.build);
        expect(stored).not.toBeNull();
        expect(stored?.status).toBe('completed');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.build(
        {
          source: 'main.swift',
          toolchainPath: '/usr/bin/swiftc',
          platform: 'macos',
          config: { mode: 'debug', features: O.none },
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('test', () => {
    it('should return testFailure when build not found', async () => {
      const storage = createTestStorage();
      const result = await handler.test(
        {
          build: 'nonexistent-build',
          toolchainPath: '/usr/bin/swiftc',
          invocation: O.none,
          testType: O.none,
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('testFailure');
      }
    });

    it('should return ok with zero results when build exists but no test results', async () => {
      const storage = createTestStorage();
      await storage.put('builds', 'build-1', { buildId: 'build-1', status: 'completed' });
      const result = await handler.test(
        {
          build: 'build-1',
          toolchainPath: '/usr/bin/swiftc',
          invocation: O.none,
          testType: O.none,
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.testType).toBe('xctest');
          expect(result.right.passed).toBe(0);
        }
      }
    });

    it('should use provided testType', async () => {
      const storage = createTestStorage();
      await storage.put('builds', 'build-1', { buildId: 'build-1', status: 'completed' });
      const result = await handler.test(
        {
          build: 'build-1',
          toolchainPath: '/usr/bin/swiftc',
          invocation: O.none,
          testType: O.some('swift-testing'),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.testType).toBe('swift-testing');
      }
    });
  });

  describe('package', () => {
    it('should return formatUnsupported for unknown format', async () => {
      const storage = createTestStorage();
      const result = await handler.package(
        { build: 'build-1', format: 'rpm' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('formatUnsupported');
      }
    });

    it('should package successfully for xcframework format', async () => {
      const storage = createTestStorage();
      await storage.put('builds', 'build-1', { buildId: 'build-1', status: 'completed' });
      const result = await handler.package(
        { build: 'build-1', format: 'xcframework' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.artifactPath).toContain('.xcframework');
        }
      }
    });

    it('should package successfully for static-lib format', async () => {
      const storage = createTestStorage();
      await storage.put('builds', 'build-1', { buildId: 'build-1', status: 'completed' });
      const result = await handler.package(
        { build: 'build-1', format: 'static-lib' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.artifactPath).toContain('.a');
      }
    });
  });

  describe('register', () => {
    it('should return registration details', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('swift-builder');
        expect(result.right.language).toBe('swift');
        expect(result.right.capabilities).toContain('compile');
        expect(result.right.capabilities).toContain('test');
      }
    });
  });
});
