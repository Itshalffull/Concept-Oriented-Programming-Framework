// RustBuilder — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { rustBuilderHandler } from './handler.js';
import type { RustBuilderStorage } from './types.js';

const createTestStorage = (): RustBuilderStorage => {
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

const createFailingStorage = (): RustBuilderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = rustBuilderHandler;

describe('RustBuilder handler', () => {
  describe('build', () => {
    it('should build successfully with no feature conflicts', async () => {
      const storage = createTestStorage();
      const result = await handler.build(
        { source: 'src/lib.rs', toolchainPath: '/usr/local/cargo', platform: 'linux-x86_64', config: { mode: 'debug', features: O.some(['serde', 'tokio']) } },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.artifactPath).toContain('debug');
        }
      }
    });

    it('should produce release artifact in production mode', async () => {
      const storage = createTestStorage();
      const result = await handler.build(
        { source: 'src/lib.rs', toolchainPath: '/cargo', platform: 'linux-x86_64', config: { mode: 'production', features: O.none } },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.artifactPath).toContain('release');
      }
    });

    it('should detect feature conflicts', async () => {
      const storage = createTestStorage();
      const result = await handler.build(
        { source: 'src/lib.rs', toolchainPath: '/cargo', platform: 'linux-x86_64', config: { mode: 'debug', features: O.some(['std', 'no_std']) } },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('featureConflict');
      }
    });

    it('should return compilationError when diagnostics exist', async () => {
      const storage = createTestStorage();
      await storage.put('rust-diagnostics', 'diag-1', { source: 'src/main.rs', severity: 'error', file: 'src/main.rs', line: 10, message: 'mismatched types' });
      const result = await handler.build(
        { source: 'src/main.rs', toolchainPath: '/cargo', platform: 'linux-x86_64', config: { mode: 'debug', features: O.none } },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('compilationError');
      }
    });
  });

  describe('test', () => {
    it('should return testFailure when build not found', async () => {
      const storage = createTestStorage();
      const result = await handler.test(
        { build: 'nonexistent', toolchainPath: '/cargo', invocation: O.none, testType: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('testFailure');
      }
    });

    it('should return ok with zero results when build exists and no test results', async () => {
      const storage = createTestStorage();
      await storage.put('builds', 'build-1', { buildId: 'build-1', status: 'completed' });
      const result = await handler.test(
        { build: 'build-1', toolchainPath: '/cargo', invocation: O.none, testType: O.some('cargo-test') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.testType).toBe('cargo-test');
        }
      }
    });
  });

  describe('package', () => {
    it('should return formatUnsupported for unknown format', async () => {
      const storage = createTestStorage();
      const result = await handler.package({ build: 'build-1', format: 'unknown-format' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('formatUnsupported');
      }
    });

    it('should package a valid build with supported format', async () => {
      const storage = createTestStorage();
      await storage.put('builds', 'build-1', { buildId: 'build-1', status: 'completed' });
      const result = await handler.package({ build: 'build-1', format: 'crate' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.artifactPath).toContain('.crate');
        }
      }
    });
  });

  describe('register', () => {
    it('should return builder capabilities', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('rust-builder');
        expect(result.right.language).toBe('rust');
        expect(result.right.capabilities.length).toBeGreaterThan(0);
      }
    });
  });
});
