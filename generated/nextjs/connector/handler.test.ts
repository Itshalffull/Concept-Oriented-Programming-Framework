// Connector — handler.test.ts
// Unit tests for connector handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { connectorHandler } from './handler.js';
import type { ConnectorStorage } from './types.js';

const handler = connectorHandler;

const createTestStorage = (): ConnectorStorage => {
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

const createFailingStorage = (): ConnectorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const validRestConfig = JSON.stringify({ baseUrl: 'https://api.example.com' });

describe('Connector handler', () => {
  describe('configure', () => {
    it('should configure a REST connector with valid config', async () => {
      const storage = createTestStorage();
      const result = await handler.configure(
        { sourceId: 'src-1', protocolId: 'rest', config: validRestConfig },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.connectorId).toContain('conn-');
        }
      }
    });

    it('should return error for unsupported protocol', async () => {
      const storage = createTestStorage();
      const result = await handler.configure(
        { sourceId: 'src-1', protocolId: 'unknown', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for invalid REST config missing baseUrl', async () => {
      const storage = createTestStorage();
      const result = await handler.configure(
        { sourceId: 'src-1', protocolId: 'rest', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for invalid JSON config', async () => {
      const storage = createTestStorage();
      const result = await handler.configure(
        { sourceId: 'src-1', protocolId: 'rest', config: 'not-json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.configure(
        { sourceId: 'src-1', protocolId: 'file', config: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('read', () => {
    it('should read data from a configured connector', async () => {
      const storage = createTestStorage();
      await handler.configure(
        { sourceId: 'src-1', protocolId: 'rest', config: validRestConfig },
        storage,
      )();
      const result = await handler.read(
        { connectorId: 'conn-src-1-rest', query: '{}', options: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when connector does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.read(
        { connectorId: 'nonexistent', query: '{}', options: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return error for invalid query JSON', async () => {
      const storage = createTestStorage();
      await handler.configure(
        { sourceId: 'src-1', protocolId: 'rest', config: validRestConfig },
        storage,
      )();
      const result = await handler.read(
        { connectorId: 'conn-src-1-rest', query: 'bad-json', options: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.read(
        { connectorId: 'conn-src-1-rest', query: '{}', options: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('write', () => {
    it('should write data to a configured connector', async () => {
      const storage = createTestStorage();
      await handler.configure(
        { sourceId: 'src-1', protocolId: 'rest', config: validRestConfig },
        storage,
      )();
      const result = await handler.write(
        {
          connectorId: 'conn-src-1-rest',
          data: JSON.stringify([{ id: 'item-1', name: 'test' }]),
          options: '{}',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.created).toBe(1);
        }
      }
    });

    it('should return notfound when connector does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.write(
        { connectorId: 'nonexistent', data: '[]', options: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.write(
        { connectorId: 'conn-src-1-rest', data: '[]', options: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('test', () => {
    it('should test connectivity of a configured connector', async () => {
      const storage = createTestStorage();
      await handler.configure(
        { sourceId: 'src-1', protocolId: 'rest', config: validRestConfig },
        storage,
      )();
      const result = await handler.test(
        { connectorId: 'conn-src-1-rest' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when connector does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.test(
        { connectorId: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.test(
        { connectorId: 'conn-src-1-rest' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('discover', () => {
    it('should discover streams from a configured connector', async () => {
      const storage = createTestStorage();
      await handler.configure(
        { sourceId: 'src-1', protocolId: 'rest', config: validRestConfig },
        storage,
      )();
      const result = await handler.discover(
        { connectorId: 'conn-src-1-rest' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const streams = JSON.parse(result.right.streams);
          expect(streams.protocol).toBe('rest');
        }
      }
    });

    it('should return notfound when connector does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.discover(
        { connectorId: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.discover(
        { connectorId: 'conn-src-1-rest' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
