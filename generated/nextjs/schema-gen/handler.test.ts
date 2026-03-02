// SchemaGen — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { schemaGenHandler } from './handler.js';
import type { SchemaGenStorage } from './types.js';

const createTestStorage = (): SchemaGenStorage => {
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

const createFailingStorage = (): SchemaGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = schemaGenHandler;

describe('SchemaGen handler', () => {
  describe('generate', () => {
    it('should generate JSON Schema and OpenAPI from a valid AST', async () => {
      const storage = createTestStorage();
      const ast = {
        name: 'order',
        operations: [
          {
            name: 'create',
            input: [{ name: 'title', type: 'string' }, { name: 'amount', type: 'number' }],
            output: [{ variant: 'ok', fields: [{ name: 'id', type: 'string' }] }],
          },
        ],
      };
      const result = await handler.generate({ spec: 'order.concept', ast }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const manifest = result.right.manifest as Record<string, unknown>;
          expect(manifest['$schema']).toBe('http://json-schema.org/draft-07/schema#');
          expect(manifest['title']).toBe('Order');
          const defs = manifest['definitions'] as Record<string, unknown>;
          expect(defs['OrderCreateInput']).toBeTruthy();
          expect(defs['OrderCreateOutputOk']).toBeTruthy();
          const openapi = manifest['openapi'] as Record<string, unknown>;
          const paths = openapi['paths'] as Record<string, unknown>;
          expect(paths['/order/create']).toBeTruthy();
        }
      }
    });

    it('should return error for null AST', async () => {
      const storage = createTestStorage();
      const result = await handler.generate({ spec: 'bad.concept', ast: null }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for AST without name', async () => {
      const storage = createTestStorage();
      const result = await handler.generate({ spec: 'bad.concept', ast: { operations: [] } }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should generate correct type mappings in definitions', async () => {
      const storage = createTestStorage();
      const ast = {
        name: 'user',
        operations: [
          {
            name: 'get',
            input: [
              { name: 'id', type: 'integer' },
              { name: 'active', type: 'boolean' },
              { name: 'created', type: 'date' },
            ],
            output: [{ variant: 'ok', fields: [{ name: 'data', type: 'object' }] }],
          },
        ],
      };
      const result = await handler.generate({ spec: 'user.concept', ast }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const defs = (result.right.manifest as Record<string, unknown>)['definitions'] as Record<string, unknown>;
        const inputDef = defs['UserGetInput'] as Record<string, unknown>;
        const props = inputDef['properties'] as Record<string, Record<string, unknown>>;
        expect(props['id']['type']).toBe('integer');
        expect(props['active']['type']).toBe('boolean');
        expect(props['created']['format']).toBe('date-time');
      }
    });

    it('should persist schema metadata to storage', async () => {
      const storage = createTestStorage();
      const ast = { name: 'payment', operations: [] };
      await handler.generate({ spec: 'payment.concept', ast }, storage)();
      const stored = await storage.get('schemas', 'payment.concept');
      expect(stored).not.toBeNull();
      expect(stored!['conceptName']).toBe('payment');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const ast = { name: 'x', operations: [] };
      const result = await handler.generate({ spec: 'x.concept', ast }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('register', () => {
    it('should return generator registration info', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('schema-gen');
        expect(result.right.inputKind).toBe('concept-ast');
        expect(result.right.outputKind).toBe('json-schema');
        expect(result.right.capabilities.length).toBeGreaterThan(0);
      }
    });
  });
});
