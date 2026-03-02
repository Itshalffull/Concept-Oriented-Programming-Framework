// SolidityBuilder — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { solidityBuilderHandler } from './handler.js';
import type { SolidityBuilderStorage } from './types.js';

const createTestStorage = (): SolidityBuilderStorage => {
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

const createFailingStorage = (): SolidityBuilderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = solidityBuilderHandler;

describe('SolidityBuilder handler', () => {
  describe('register', () => {
    it('should return builder registration metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('solidity-builder');
        expect(result.right.language).toBe('solidity');
        expect(result.right.capabilities).toContain('compile');
        expect(result.right.capabilities).toContain('abi-gen');
      }
    });
  });

  describe('build', () => {
    it('should build successfully with no diagnostics or pragma issues', async () => {
      const storage = createTestStorage();
      const result = await handler.build(
        {
          source: 'MyContract.sol',
          toolchainPath: '/usr/bin/solc',
          platform: 'evm',
          config: { mode: 'release', features: O.none },
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.build).toContain('solbuild-');
          expect(result.right.artifactPath).toContain('artifacts/');
          expect(result.right.artifactHash).toContain('sha256-');
        }
      }
    });

    it('should return pragmaMismatch when versions differ', async () => {
      const storage = createTestStorage();
      await storage.put('solidity-pragma', 'Versioned.sol', {
        required: '0.8.20',
        installed: '0.8.10',
      });
      const result = await handler.build(
        {
          source: 'Versioned.sol',
          toolchainPath: '/usr/bin/solc',
          platform: 'evm',
          config: { mode: 'release', features: O.none },
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('pragmaMismatch');
        if (result.right.variant === 'pragmaMismatch') {
          expect(result.right.required).toBe('0.8.20');
          expect(result.right.installed).toBe('0.8.10');
        }
      }
    });

    it('should return compilationError when diagnostics exist', async () => {
      const storage = createTestStorage();
      await storage.put('solidity-diagnostics', 'diag-1', {
        source: 'Broken.sol',
        severity: 'error',
        file: 'Broken.sol',
        line: 10,
        message: 'Undeclared identifier',
      });
      const result = await handler.build(
        {
          source: 'Broken.sol',
          toolchainPath: '/usr/bin/solc',
          platform: 'evm',
          config: { mode: 'debug', features: O.none },
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('compilationError');
        if (result.right.variant === 'compilationError') {
          expect(result.right.errors.length).toBeGreaterThan(0);
          expect(result.right.errors[0].message).toBe('Undeclared identifier');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.build(
        {
          source: 'Fail.sol',
          toolchainPath: '/usr/bin/solc',
          platform: 'evm',
          config: { mode: 'release', features: O.none },
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('test', () => {
    it('should return testFailure when build does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.test(
        { build: 'nonexistent', toolchainPath: '/usr/bin/forge', invocation: O.none, testType: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('testFailure');
      }
    });

    it('should return ok with zero tests when no test results exist', async () => {
      const storage = createTestStorage();
      await storage.put('builds', 'build-ok', { buildId: 'build-ok', status: 'completed' });
      const result = await handler.test(
        { build: 'build-ok', toolchainPath: '/usr/bin/forge', invocation: O.none, testType: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.passed).toBe(0);
          expect(result.right.testType).toBe('forge');
        }
      }
    });
  });

  describe('package', () => {
    it('should package a build in abi format', async () => {
      const storage = createTestStorage();
      await storage.put('builds', 'pkg-build', { buildId: 'pkg-build', status: 'completed' });
      const result = await handler.package(
        { build: 'pkg-build', format: 'abi' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.artifactPath).toContain('.abi.json');
        }
      }
    });

    it('should return formatUnsupported for unknown format', async () => {
      const storage = createTestStorage();
      const result = await handler.package(
        { build: 'pkg-build', format: 'wasm' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('formatUnsupported');
      }
    });

    it('should package in bytecode format', async () => {
      const storage = createTestStorage();
      await storage.put('builds', 'bin-build', { buildId: 'bin-build', status: 'completed' });
      const result = await handler.package(
        { build: 'bin-build', format: 'bytecode' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.artifactPath).toContain('.bin');
      }
    });
  });
});
