// ContentParser — handler.test.ts
// Unit tests for contentParser handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { contentParserHandler } from './handler.js';
import type { ContentParserStorage } from './types.js';

const handler = contentParserHandler;

const createTestStorage = (): ContentParserStorage => {
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

const createFailingStorage = (): ContentParserStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

/** Helper to register markdown format and parse content. */
const setupParsedContent = async (
  storage: ContentParserStorage,
  contentId: string,
  text: string,
) => {
  await handler.registerFormat({ name: 'markdown', grammar: 'md-grammar' }, storage)();
  await handler.parse({ content: contentId, text, format: 'markdown' }, storage)();
};

describe('ContentParser handler', () => {
  describe('registerFormat', () => {
    it('should register a new format', async () => {
      const storage = createTestStorage();
      const result = await handler.registerFormat(
        { name: 'markdown', grammar: 'md-grammar' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.name).toBe('markdown');
        }
      }
    });

    it('should return exists when format already registered', async () => {
      const storage = createTestStorage();
      await handler.registerFormat({ name: 'markdown', grammar: 'mg' }, storage)();
      const result = await handler.registerFormat(
        { name: 'markdown', grammar: 'mg' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.registerFormat(
        { name: 'markdown', grammar: 'mg' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('registerExtractor', () => {
    it('should register a new extractor', async () => {
      const storage = createTestStorage();
      const result = await handler.registerExtractor(
        { name: 'ref-extractor', pattern: '\\[\\[(.+?)\\]\\]' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.name).toBe('ref-extractor');
        }
      }
    });

    it('should return exists when extractor already registered', async () => {
      const storage = createTestStorage();
      await handler.registerExtractor({ name: 'ref-extractor', pattern: '.*' }, storage)();
      const result = await handler.registerExtractor(
        { name: 'ref-extractor', pattern: '.*' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.registerExtractor(
        { name: 'ref-extractor', pattern: '.*' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('parse', () => {
    it('should parse markdown content into an AST', async () => {
      const storage = createTestStorage();
      await handler.registerFormat({ name: 'markdown', grammar: 'mg' }, storage)();
      const result = await handler.parse(
        { content: 'doc-1', text: '# Hello\n\nWorld', format: 'markdown' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const ast = JSON.parse(result.right.ast);
          expect(ast.type).toBe('document');
          expect(ast.children.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return error when format is not registered', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { content: 'doc-1', text: 'Hello', format: 'unregistered' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.parse(
        { content: 'doc-1', text: 'Hello', format: 'markdown' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('extractRefs', () => {
    it('should extract references from a parsed document', async () => {
      const storage = createTestStorage();
      await setupParsedContent(
        storage,
        'doc-refs',
        'See [[OtherPage]] and [Link](https://example.com)',
      );
      const result = await handler.extractRefs({ content: 'doc-refs' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const refs = JSON.parse(result.right.refs);
          expect(refs).toContain('OtherPage');
          expect(refs).toContain('https://example.com');
        }
      }
    });

    it('should return notfound when no AST is cached', async () => {
      const storage = createTestStorage();
      const result = await handler.extractRefs({ content: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.extractRefs({ content: 'doc-1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('extractTags', () => {
    it('should extract hashtags from a parsed document', async () => {
      const storage = createTestStorage();
      await setupParsedContent(
        storage,
        'doc-tags',
        'This has #important and #todo tags',
      );
      const result = await handler.extractTags({ content: 'doc-tags' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const tags = JSON.parse(result.right.tags);
          expect(tags).toContain('important');
          expect(tags).toContain('todo');
        }
      }
    });

    it('should return notfound when no AST is cached', async () => {
      const storage = createTestStorage();
      const result = await handler.extractTags({ content: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.extractTags({ content: 'doc-1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('extractProperties', () => {
    it('should extract properties from a parsed document', async () => {
      const storage = createTestStorage();
      await setupParsedContent(
        storage,
        'doc-props',
        'status:: published\npriority:: high',
      );
      const result = await handler.extractProperties({ content: 'doc-props' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const props = JSON.parse(result.right.properties);
          expect(props.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return notfound when no AST is cached', async () => {
      const storage = createTestStorage();
      const result = await handler.extractProperties({ content: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.extractProperties({ content: 'doc-1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('serialize', () => {
    it('should serialize a parsed AST back to markdown', async () => {
      const storage = createTestStorage();
      await setupParsedContent(storage, 'doc-ser', '# Title\n\nParagraph text');
      const result = await handler.serialize(
        { content: 'doc-ser', format: 'markdown' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.text).toContain('Title');
          expect(result.right.text).toContain('Paragraph text');
        }
      }
    });

    it('should return notfound when no AST is cached', async () => {
      const storage = createTestStorage();
      const result = await handler.serialize(
        { content: 'nonexistent', format: 'markdown' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.serialize(
        { content: 'doc-1', format: 'markdown' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
