// SolidityToolchain — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { solidityToolchainHandler } from './handler.js';
import type { SolidityToolchainStorage } from './types.js';

const createTestStorage = (): SolidityToolchainStorage => {
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

const createFailingStorage = (): SolidityToolchainStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = solidityToolchainHandler;

describe('SolidityToolchain handler', () => {
  describe('register', () => {
    it('should return toolchain registration metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('solidity-toolchain');
        expect(result.right.language).toBe('solidity');
        expect(result.right.capabilities).toContain('compile');
      }
    });
  });

  describe('resolve', () => {
    it('should return notInstalled when no solc found', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve(
        { platform: 'evm', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notInstalled');
        if (result.right.variant === 'notInstalled') {
          expect(result.right.installHint).toContain('solc');
        }
      }
    });

    it('should resolve installed solc with matching version', async () => {
      const storage = createTestStorage();
      await storage.put('solidity-installations', 'evm', {
        version: '0.8.20',
        solcPath: '/usr/local/bin/solc',
      });
      const result = await handler.resolve(
        { platform: 'evm', versionConstraint: O.some('0.8.0') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.version).toBe('0.8.20');
          expect(result.right.solcPath).toBe('/usr/local/bin/solc');
          expect(result.right.capabilities.length).toBeGreaterThan(0);
        }
      }
    });

    it('should resolve without version constraint', async () => {
      const storage = createTestStorage();
      await storage.put('solidity-installations', 'evm', {
        version: '0.8.15',
        solcPath: '/usr/bin/solc',
      });
      const result = await handler.resolve(
        { platform: 'evm', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return evmVersionUnsupported for unknown platform', async () => {
      const storage = createTestStorage();
      await storage.put('solidity-installations', 'polygon', {
        version: '0.8.20',
        solcPath: '/usr/bin/solc',
      });
      const result = await handler.resolve(
        { platform: 'polygon', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('evmVersionUnsupported');
        if (result.right.variant === 'evmVersionUnsupported') {
          expect(result.right.requested).toBe('polygon');
          expect(result.right.supported.length).toBeGreaterThan(0);
        }
      }
    });

    it('should accept supported EVM version (shanghai)', async () => {
      const storage = createTestStorage();
      await storage.put('solidity-installations', 'shanghai', {
        version: '0.8.20',
        solcPath: '/usr/bin/solc',
      });
      const result = await handler.resolve(
        { platform: 'shanghai', versionConstraint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.resolve(
        { platform: 'evm', versionConstraint: O.none },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
