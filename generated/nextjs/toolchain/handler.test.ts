// Toolchain — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { toolchainHandler } from './handler.js';
import type { ToolchainStorage } from './types.js';

const createTestStorage = (): ToolchainStorage => {
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

const createFailingStorage = (): ToolchainStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Toolchain handler', () => {
  describe('resolve', () => {
    it('should resolve an installed toolchain', async () => {
      const storage = createTestStorage();
      await storage.put('toolchains', 'typescript:typescript-default', {
        version: '5.3.0',
        path: '/usr/local/bin/tsc',
        capabilities: ['compile', 'check', 'emit'],
        command: 'tsc',
      });

      const result = await toolchainHandler.resolve(
        {
          language: 'typescript',
          platform: 'node',
          versionConstraint: O.none,
          category: O.none,
          toolName: O.none,
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.version).toBe('5.3.0');
          expect(result.right.capabilities).toContain('compile');
        }
      }
    });

    it('should return notInstalled when toolchain is not found', async () => {
      const storage = createTestStorage();

      const result = await toolchainHandler.resolve(
        {
          language: 'typescript',
          platform: 'node',
          versionConstraint: O.none,
          category: O.none,
          toolName: O.none,
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notInstalled');
        if (result.right.variant === 'notInstalled') {
          expect(result.right.installHint).toContain('npm');
        }
      }
    });

    it('should return platformUnsupported for an unknown platform', async () => {
      const storage = createTestStorage();

      const result = await toolchainHandler.resolve(
        {
          language: 'typescript',
          platform: 'gameboy',
          versionConstraint: O.none,
          category: O.none,
          toolName: O.none,
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('platformUnsupported');
      }
    });

    it('should return versionMismatch when version constraint is not met', async () => {
      const storage = createTestStorage();
      await storage.put('toolchains', 'typescript:typescript-default', {
        version: '4.0.0',
        path: '/usr/local/bin/tsc',
        capabilities: ['compile'],
        command: 'tsc',
      });

      const result = await toolchainHandler.resolve(
        {
          language: 'typescript',
          platform: 'node',
          versionConstraint: O.some('5.0.0'),
          category: O.none,
          toolName: O.none,
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('versionMismatch');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await toolchainHandler.resolve(
        {
          language: 'typescript',
          platform: 'node',
          versionConstraint: O.none,
          category: O.none,
          toolName: O.none,
        },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return ok for a valid toolchain', async () => {
      const storage = createTestStorage();
      await storage.put('toolchains', 'tsc', { version: '5.3.0' });

      const result = await toolchainHandler.validate(
        { tool: 'tsc' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.version).toBe('5.3.0');
        }
      }
    });

    it('should return invalid for a missing toolchain', async () => {
      const storage = createTestStorage();

      const result = await toolchainHandler.validate(
        { tool: 'missing' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });
  });

  describe('list', () => {
    it('should list all toolchains', async () => {
      const storage = createTestStorage();
      await storage.put('toolchains', 'ts-1', {
        language: 'typescript',
        platform: 'node',
        version: '5.3.0',
        category: 'compiler',
      });
      await storage.put('toolchains', 'rs-1', {
        language: 'rust',
        platform: 'linux-x86_64',
        version: '1.75.0',
        category: 'compiler',
      });

      const result = await toolchainHandler.list(
        { language: O.none, category: O.none },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.tools).toHaveLength(2);
      }
    });

    it('should filter by language', async () => {
      const storage = createTestStorage();
      await storage.put('toolchains', 'ts-1', { language: 'typescript', version: '5.3.0' });
      await storage.put('toolchains', 'rs-1', { language: 'rust', version: '1.75.0' });

      const result = await toolchainHandler.list(
        { language: O.some('typescript'), category: O.none },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.tools).toHaveLength(1);
        expect(result.right.tools[0].language).toBe('typescript');
      }
    });
  });

  describe('capabilities', () => {
    it('should return capabilities for a known tool', async () => {
      const storage = createTestStorage();
      await storage.put('toolchains', 'tsc', {
        capabilities: ['compile', 'check', 'emit'],
      });

      const result = await toolchainHandler.capabilities(
        { tool: 'tsc' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.capabilities).toContain('compile');
      }
    });

    it('should return empty capabilities for an unknown tool', async () => {
      const storage = createTestStorage();

      const result = await toolchainHandler.capabilities(
        { tool: 'missing' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.capabilities).toHaveLength(0);
      }
    });
  });
});
