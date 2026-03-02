// CliTarget — handler.test.ts
// Unit tests for cliTarget handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { cliTargetHandler } from './handler.js';
import type { CliTargetStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): CliTargetStorage => {
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

// Failing storage for error propagation tests
const createFailingStorage = (): CliTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('CliTarget handler', () => {
  describe('generate', () => {
    it('should return ok with commands and files for non-JSON concept name', async () => {
      const storage = createTestStorage();

      const result = await cliTargetHandler.generate(
        { projection: 'UserProfile', config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.commands.length).toBeGreaterThan(0);
          expect(result.right.files.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return ok with commands for valid JSON projection', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'Task',
        actions: [
          { name: 'create', positional: ['name'], flags: ['--verbose'] },
          { name: 'list', positional: [], flags: ['--limit'] },
        ],
      });

      const result = await cliTargetHandler.generate(
        { projection, config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return tooManyPositional when action exceeds limit', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'Task',
        actions: [
          { name: 'create', positional: ['a', 'b', 'c', 'd'], flags: [] },
        ],
      });

      const result = await cliTargetHandler.generate(
        { projection, config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('tooManyPositional');
        if (result.right.variant === 'tooManyPositional') {
          expect(result.right.action).toBe('create');
          expect(result.right.count).toBe(4);
        }
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cliTargetHandler.generate(
        { projection: 'Task', config: '{}' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return ok when no flag collisions exist', async () => {
      const storage = createTestStorage();
      await storage.put('commands', 'task create', {
        command: 'task',
        action: 'create',
        flags: ['--verbose'],
      });
      await storage.put('commands', 'task list', {
        command: 'task',
        action: 'list',
        flags: ['--limit'],
      });

      const result = await cliTargetHandler.validate(
        { command: 'task' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return flagCollision when non-global flags collide', async () => {
      const storage = createTestStorage();
      await storage.put('commands', 'task create', {
        command: 'task',
        action: 'create',
        flags: ['--target'],
      });
      await storage.put('commands', 'task delete', {
        command: 'task',
        action: 'delete',
        flags: ['--target'],
      });

      const result = await cliTargetHandler.validate(
        { command: 'task' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('flagCollision');
        if (result.right.variant === 'flagCollision') {
          expect(result.right.flag).toBe('--target');
        }
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cliTargetHandler.validate(
        { command: 'task' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('listCommands', () => {
    it('should return ok with commands and subcommands', async () => {
      const storage = createTestStorage();
      await storage.put('commands', 'task create', {
        concept: 'Task',
        command: 'task',
        subcommand: 'task create',
      });

      const result = await cliTargetHandler.listCommands(
        { concept: 'Task' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return ok with empty lists when no commands exist', async () => {
      const storage = createTestStorage();

      const result = await cliTargetHandler.listCommands(
        { concept: 'Nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.commands.length).toBe(0);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cliTargetHandler.listCommands(
        { concept: 'Task' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
