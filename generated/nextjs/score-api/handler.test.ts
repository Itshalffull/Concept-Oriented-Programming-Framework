// ScoreApi — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { scoreApiHandler } from './handler.js';
import type { ScoreApiStorage } from './types.js';

const createTestStorage = (): ScoreApiStorage => {
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

const createFailingStorage = (): ScoreApiStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = scoreApiHandler;

describe('ScoreApi handler', () => {
  describe('listFiles', () => {
    it('should return matching files', async () => {
      const storage = createTestStorage();
      await storage.put('file', 'src/main.ts', { path: 'src/main.ts', language: 'ts', role: 'source', size: 100 });
      await storage.put('file', 'src/lib.ts', { path: 'src/lib.ts', language: 'ts', role: 'source', size: 200 });
      const result = await handler.listFiles({ pattern: 'src/**' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.files.length).toBe(2);
        }
      }
    });

    it('should return empty when no files match', async () => {
      const storage = createTestStorage();
      const result = await handler.listFiles({ pattern: 'nonexistent/**' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('empty');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.listFiles({ pattern: '*' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getFileContent', () => {
    it('should return file content', async () => {
      const storage = createTestStorage();
      await storage.put('file', 'src/main.ts', { path: 'src/main.ts', content: 'console.log("hi")', language: 'ts', definitions: ['main'] });
      const result = await handler.getFileContent({ path: 'src/main.ts' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.content).toBe('console.log("hi")');
          expect(result.right.language).toBe('ts');
        }
      }
    });

    it('should return notFound for missing file', async () => {
      const storage = createTestStorage();
      const result = await handler.getFileContent({ path: 'missing.ts' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });
  });

  describe('findSymbol', () => {
    it('should find matching symbols', async () => {
      const storage = createTestStorage();
      await storage.put('symbol', 'User', { name: 'User', kind: 'interface', file: 'types.ts', line: 5, scope: 'global' });
      const result = await handler.findSymbol({ name: 'User' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.symbols.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return notFound for unknown symbol', async () => {
      const storage = createTestStorage();
      const result = await handler.findSymbol({ name: 'NonExistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });
  });

  describe('matchPattern', () => {
    it('should return invalidPattern for bad regex', async () => {
      const storage = createTestStorage();
      const result = await handler.matchPattern({ pattern: '[invalid', language: 'ts' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidPattern');
      }
    });

    it('should match lines in file content', async () => {
      const storage = createTestStorage();
      await storage.put('file', 'app.ts', { path: 'app.ts', language: 'ts', content: 'const x = 1;\nconst y = 2;\nfoo();' });
      const result = await handler.matchPattern({ pattern: 'const', language: 'ts' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.matches.length).toBe(2);
        }
      }
    });
  });

  describe('search', () => {
    it('should return ranked results for matching symbols', async () => {
      const storage = createTestStorage();
      await storage.put('symbol', 'UserService', { name: 'UserService', kind: 'class', file: 'svc.ts', line: 1, snippet: '' });
      await storage.put('symbol', 'UserRepo', { name: 'UserRepo', kind: 'class', file: 'repo.ts', line: 1, snippet: '' });
      const result = await handler.search({ query: 'User', limit: 10 }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.results.length).toBe(2);
        }
      }
    });

    it('should return empty when no symbols match', async () => {
      const storage = createTestStorage();
      const result = await handler.search({ query: 'zzzzz', limit: 10 }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('empty');
      }
    });
  });

  describe('getConcept', () => {
    it('should return concept details', async () => {
      const storage = createTestStorage();
      await storage.put('concept', 'Order', {
        name: 'Order',
        purpose: 'Manage orders',
        typeParams: [],
        actions: [{ name: 'create', params: ['title'], variants: ['ok', 'error'] }],
        stateFields: [{ name: 'orders', type: 'Map', relation: 'orders' }],
        invariants: [],
        file: 'order.concept',
      });
      const result = await handler.getConcept({ name: 'Order' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.concept.name).toBe('Order');
          expect(result.right.concept.purpose).toBe('Manage orders');
        }
      }
    });

    it('should return notFound for unknown concept', async () => {
      const storage = createTestStorage();
      const result = await handler.getConcept({ name: 'Missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });
  });

  describe('getAction', () => {
    it('should return action details', async () => {
      const storage = createTestStorage();
      await storage.put('action', 'Order::create', {
        name: 'create',
        params: [{ name: 'title', type: 'string' }],
        variants: [{ name: 'ok', fields: ['id'], prose: 'Created successfully' }],
        description: 'Create a new order',
      });
      const result = await handler.getAction({ concept: 'Order', action: 'create' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.action.name).toBe('create');
        }
      }
    });

    it('should return notFound for unknown action', async () => {
      const storage = createTestStorage();
      const result = await handler.getAction({ concept: 'Order', action: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });
  });

  describe('explain', () => {
    it('should explain a symbol', async () => {
      const storage = createTestStorage();
      await storage.put('symbol', 'User', { name: 'User', kind: 'interface', file: 'types.ts', line: 1 });
      const result = await handler.explain({ symbol: 'User' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.summary).toContain('User');
          expect(result.right.kind).toBe('interface');
          expect(result.right.definedIn).toBe('types.ts');
        }
      }
    });

    it('should return notFound for unknown symbol', async () => {
      const storage = createTestStorage();
      const result = await handler.explain({ symbol: 'Unknown' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });
  });

  describe('status', () => {
    it('should return index status counts', async () => {
      const storage = createTestStorage();
      await storage.put('file', 'a.ts', { path: 'a.ts' });
      await storage.put('concept', 'X', { name: 'X' });
      const result = await handler.status({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.fileCount).toBe(1);
        expect(result.right.conceptCount).toBe(1);
        expect(result.right.indexed).toBe(true);
      }
    });
  });

  describe('reindex', () => {
    it('should reindex and return counts', async () => {
      const storage = createTestStorage();
      await storage.put('file', 'a.ts', { path: 'a.ts' });
      const result = await handler.reindex({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.fileCount).toBe(1);
          expect(result.right.duration).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should return inProgress when reindex is already running', async () => {
      const storage = createTestStorage();
      await storage.put('meta', 'index_status', { status: 'in_progress', startedAt: new Date().toISOString() });
      const result = await handler.reindex({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('inProgress');
      }
    });
  });

  describe('getFlow', () => {
    it('should trace sync-driven flow', async () => {
      const storage = createTestStorage();
      await storage.put('sync', 'order-notify', {
        name: 'order-notify',
        when: [{ concept: 'Order', action: 'create' }],
        then: [{ concept: 'Notification', action: 'send', variant: 'ok' }],
      });
      const result = await handler.getFlow({ startConcept: 'Order', startAction: 'create' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.flow.length).toBeGreaterThan(0);
          expect(result.right.flow[0].concept).toBe('Notification');
        }
      }
    });

    it('should return notFound when no flow exists', async () => {
      const storage = createTestStorage();
      const result = await handler.getFlow({ startConcept: 'X', startAction: 'y' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });
  });

  describe('getDataFlow', () => {
    it('should return noPath when source symbol not found', async () => {
      const storage = createTestStorage();
      const result = await handler.getDataFlow({ from: 'A', to: 'B' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noPath');
      }
    });
  });
});
