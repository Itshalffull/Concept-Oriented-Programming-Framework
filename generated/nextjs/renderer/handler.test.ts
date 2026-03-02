// Renderer — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { rendererHandler } from './handler.js';
import type { RendererStorage } from './types.js';

const createTestStorage = (): RendererStorage => {
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

const createFailingStorage = (): RendererStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = rendererHandler;

describe('Renderer handler', () => {
  describe('render', () => {
    it('should render a simple tree and return ok', async () => {
      const storage = createTestStorage();
      const result = await handler.render(
        { renderer: 'main', tree: '<div>Hello World</div>' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.output).toContain('Hello World');
        }
      }
    });

    it('should resolve mustache-style placeholders', async () => {
      const storage = createTestStorage();
      // Register a placeholder
      await storage.put('renderers', 'r1', {
        rendererId: 'r1',
        placeholders: JSON.stringify({ title: 'My Title' }),
      });

      const result = await handler.render(
        { renderer: 'r1', tree: '<h1>{{title}}</h1>' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.output).toContain('My Title');
      }
    });

    it('should resolve self-closing placeholder tags and wrap matched content', async () => {
      const storage = createTestStorage();
      await storage.put('renderers', 'r2', {
        rendererId: 'r2',
        placeholders: JSON.stringify({ sidebar: '<nav>Nav</nav>' }),
      });

      const result = await handler.render(
        { renderer: 'r2', tree: '<sidebar/>' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        // The handler first resolves <sidebar/> to <nav>Nav</nav>, then the
        // wrapping tag regex matches <nav>Nav</nav> and converts it to
        // <section data-component="nav">Nav</section>.
        expect(result.right.output).toContain('<section data-component="nav">Nav</section>');
      }
    });

    it('should render unresolved placeholders as empty placeholder divs', async () => {
      const storage = createTestStorage();
      const result = await handler.render(
        { renderer: 'r3', tree: '<unknown/>' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.output).toContain('data-placeholder="unknown"');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.render(
        { renderer: 'r', tree: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('autoPlaceholder', () => {
    it('should register a placeholder and return the token', async () => {
      const storage = createTestStorage();
      const result = await handler.autoPlaceholder(
        { renderer: 'r1', name: 'footer' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.placeholder).toBe('{{footer}}');
      }
    });

    it('should store the placeholder in the renderer record', async () => {
      const storage = createTestStorage();
      await handler.autoPlaceholder(
        { renderer: 'ap-r', name: 'header' },
        storage,
      )();

      const rendererRec = await storage.get('renderers', 'ap-r');
      expect(rendererRec).not.toBeNull();
      if (rendererRec) {
        const placeholders = JSON.parse(rendererRec.placeholders as string);
        expect(placeholders.header).toBeDefined();
      }
    });
  });

  describe('stream', () => {
    it('should return error for empty tree', async () => {
      const storage = createTestStorage();
      const result = await handler.stream(
        { renderer: 'sr', tree: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for whitespace-only tree', async () => {
      const storage = createTestStorage();
      const result = await handler.stream(
        { renderer: 'sr', tree: '   ' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should start a stream session and return stream id', async () => {
      const storage = createTestStorage();
      const result = await handler.stream(
        { renderer: 'sr', tree: '<div>content</div>' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.streamId).toContain('stream-sr-');
        }
      }
    });
  });

  describe('mergeCacheability', () => {
    it('should merge cache tags and return merged cacheability metadata', async () => {
      const storage = createTestStorage();
      const tags = JSON.stringify([
        { tag: 'user', maxAge: 300, contexts: ['session'] },
        { tag: 'content', maxAge: 3600 },
      ]);
      const result = await handler.mergeCacheability(
        { renderer: 'cr', tags },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const merged = JSON.parse(result.right.merged);
        expect(merged.maxAge).toBe(300); // minimum
        expect(merged.isCacheable).toBe(true);
        expect(merged.tags).toContain('user');
        expect(merged.tags).toContain('content');
      }
    });

    it('should report isCacheable=false when maxAge is 0', async () => {
      const storage = createTestStorage();
      const tags = JSON.stringify([
        { tag: 'volatile', maxAge: 0 },
      ]);
      const result = await handler.mergeCacheability(
        { renderer: 'cr2', tags },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const merged = JSON.parse(result.right.merged);
        expect(merged.isCacheable).toBe(false);
      }
    });

    it('should deduplicate tags and keep lowest maxAge', async () => {
      const storage = createTestStorage();
      const tags1 = JSON.stringify([{ tag: 'auth', maxAge: 600 }]);
      await handler.mergeCacheability({ renderer: 'dedup', tags: tags1 }, storage)();

      const tags2 = JSON.stringify([{ tag: 'auth', maxAge: 120 }]);
      const result = await handler.mergeCacheability({ renderer: 'dedup', tags: tags2 }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const merged = JSON.parse(result.right.merged);
        expect(merged.maxAge).toBe(120);
      }
    });
  });
});
