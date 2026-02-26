// ============================================================
// ConceptSpecSymbolExtractor Handler Tests
//
// Tests for extracting symbols from .concept spec files:
// concept names, action names, variant names, and state fields.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  conceptSpecSymbolExtractorHandler,
  resetConceptSpecSymbolExtractorCounter,
} from '../handlers/ts/concept-spec-symbol-extractor.handler.js';

describe('ConceptSpecSymbolExtractor', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetConceptSpecSymbolExtractorCounter();
  });

  // ── initialize ────────────────────────────────────────────

  describe('initialize', () => {
    it('initializes and returns ok with an instance id', async () => {
      const result = await conceptSpecSymbolExtractorHandler.initialize({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('concept-spec-symbol-extractor-1');
    });
  });

  // ── extract ───────────────────────────────────────────────

  describe('extract', () => {
    it('extracts concept declaration', async () => {
      const source = `concept Article {
  purpose: "Manages articles"
}`;
      const result = await conceptSpecSymbolExtractorHandler.extract({
        source, file: 'article.concept',
      }, storage);

      expect(result.variant).toBe('ok');
      const symbols = JSON.parse(result.symbols as string);
      const concept = symbols.find((s: Record<string, string>) => s.kind === 'concept');
      expect(concept).toBeDefined();
      expect(concept.symbolString).toBe('clef/concept/Article');
      expect(concept.displayName).toBe('Article');
      expect(concept.role).toBe('definition');
      expect(concept.line).toBe(1);
    });

    it('extracts concept with type parameter', async () => {
      const source = `concept Collection [T] {
  purpose: "A generic collection"
}`;
      const result = await conceptSpecSymbolExtractorHandler.extract({
        source, file: 'collection.concept',
      }, storage);

      expect(result.variant).toBe('ok');
      const symbols = JSON.parse(result.symbols as string);
      const concept = symbols.find((s: Record<string, string>) => s.kind === 'concept');
      expect(concept.symbolString).toBe('clef/concept/Collection');
    });

    it('extracts state fields', async () => {
      const source = `concept Article {
  title: String
  author: String -> User
  tags: set Tag
}`;
      const result = await conceptSpecSymbolExtractorHandler.extract({
        source, file: 'article.concept',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const stateFields = symbols.filter((s: Record<string, string>) => s.kind === 'state-field');
      expect(stateFields).toHaveLength(3);
      expect(stateFields.map((s: Record<string, string>) => s.displayName)).toContain('title');
      expect(stateFields.map((s: Record<string, string>) => s.displayName)).toContain('author');
      expect(stateFields.map((s: Record<string, string>) => s.displayName)).toContain('tags');
    });

    it('skips section keywords as state fields', async () => {
      const source = `concept Article {
  purpose: "test"
  state: "test"
  actions: "test"
}`;
      const result = await conceptSpecSymbolExtractorHandler.extract({
        source, file: 'article.concept',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const stateFields = symbols.filter((s: Record<string, string>) => s.kind === 'state-field');
      expect(stateFields).toHaveLength(0);
    });

    it('extracts action declarations', async () => {
      const source = `concept Article {
  action create(title: String, body: String)
  action publish(date: Date)
}`;
      const result = await conceptSpecSymbolExtractorHandler.extract({
        source, file: 'article.concept',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const actions = symbols.filter((s: Record<string, string>) => s.kind === 'action');
      expect(actions).toHaveLength(2);
      expect(actions[0].symbolString).toBe('clef/concept/Article/action/create');
      expect(actions[1].symbolString).toBe('clef/concept/Article/action/publish');
    });

    it('extracts variant declarations', async () => {
      const source = `concept Article {
  action create(title: String)
    -> ok(article: Article)
    -> invalidTitle(reason: String)
}`;
      const result = await conceptSpecSymbolExtractorHandler.extract({
        source, file: 'article.concept',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const variants = symbols.filter((s: Record<string, string>) => s.kind === 'variant');
      expect(variants).toHaveLength(2);
      expect(variants[0].symbolString).toBe('clef/concept/Article/variant/ok');
      expect(variants[1].symbolString).toBe('clef/concept/Article/variant/invalidTitle');
    });

    it('returns empty symbols for empty source', async () => {
      const result = await conceptSpecSymbolExtractorHandler.extract({
        source: '', file: 'empty.concept',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      expect(symbols).toHaveLength(0);
    });

    it('extracts complete concept with all symbol types', async () => {
      const source = `concept Todo {
  title: String
  done: Boolean
  action complete(id: ID)
    -> ok(todo: Todo)
    -> notFound(id: ID)
  action create(title: String)
    -> ok(todo: Todo)
}`;
      const result = await conceptSpecSymbolExtractorHandler.extract({
        source, file: 'todo.concept',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const concepts = symbols.filter((s: Record<string, string>) => s.kind === 'concept');
      const fields = symbols.filter((s: Record<string, string>) => s.kind === 'state-field');
      const actions = symbols.filter((s: Record<string, string>) => s.kind === 'action');
      const variants = symbols.filter((s: Record<string, string>) => s.kind === 'variant');

      expect(concepts).toHaveLength(1);
      expect(fields).toHaveLength(2);
      expect(actions).toHaveLength(2);
      expect(variants).toHaveLength(3);
    });
  });

  // ── getSupportedExtensions ────────────────────────────────

  describe('getSupportedExtensions', () => {
    it('returns .concept extension', async () => {
      const result = await conceptSpecSymbolExtractorHandler.getSupportedExtensions({}, storage);
      expect(result.variant).toBe('ok');
      const extensions = JSON.parse(result.extensions as string);
      expect(extensions).toContain('.concept');
    });
  });
});
