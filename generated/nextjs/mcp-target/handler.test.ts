// McpTarget — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { mcpTargetHandler } from './handler.js';
import type { McpTargetStorage } from './types.js';

const createTestStorage = (): McpTargetStorage => {
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

const createFailingStorage = (): McpTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = mcpTargetHandler;

describe('McpTarget handler', () => {
  describe('generate', () => {
    it('should generate MCP tools from a concept projection', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'DataStore',
        actions: [
          { name: 'get', description: 'Get a record' },
          { name: 'put', description: 'Put a record' },
        ],
        resources: ['records'],
      });
      const result = await handler.generate(
        { projection, config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.tools).toHaveLength(2);
          expect(result.right.files).toHaveLength(1);
          expect(result.right.tools[0]).toContain('data_store');
        }
      }
    });

    it('should return tooManyTools when exceeding limit', async () => {
      const storage = createTestStorage();
      // Pre-populate storage with many tools
      for (let i = 0; i < 127; i++) {
        await storage.put('tools', `tool-${i}`, { toolName: `tool-${i}` });
      }
      const projection = JSON.stringify({
        concept: 'Overflow',
        actions: [
          { name: 'a', description: 'a' },
          { name: 'b', description: 'b' },
        ],
        resources: [],
      });
      const result = await handler.generate(
        { projection, config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('tooManyTools');
        if (result.right.variant === 'tooManyTools') {
          expect(result.right.limit).toBe(128);
        }
      }
    });

    it('should handle non-JSON projection gracefully', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { projection: 'plain-text-concept', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.tools).toHaveLength(0);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const projection = JSON.stringify({
        concept: 'Fail',
        actions: [{ name: 'act', description: 'action' }],
        resources: [],
      });
      const result = await handler.generate(
        { projection, config: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return ok for tool with description', async () => {
      const storage = createTestStorage();
      await storage.put('tools', 'my_tool', {
        toolName: 'my_tool',
        description: 'Does something',
      });
      const result = await handler.validate({ tool: 'my_tool' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return missingDescription for tool without description', async () => {
      const storage = createTestStorage();
      await storage.put('tools', 'empty_desc', {
        toolName: 'empty_desc',
        description: '',
      });
      const result = await handler.validate({ tool: 'empty_desc' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('missingDescription');
      }
    });

    it('should return ok for tool not in storage (not yet generated)', async () => {
      const storage = createTestStorage();
      const result = await handler.validate({ tool: 'unknown_tool' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('listTools', () => {
    it('should list tools for a concept', async () => {
      const storage = createTestStorage();
      await storage.put('tools', 'data_store_get', {
        concept: 'DataStore',
        toolName: 'data_store_get',
      });
      await storage.put('resources', 'datastore://records', {
        concept: 'DataStore',
        uri: 'datastore://records',
      });
      const result = await handler.listTools(
        { concept: 'DataStore' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });
});
