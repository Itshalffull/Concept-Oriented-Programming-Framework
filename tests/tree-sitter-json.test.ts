// ============================================================
// TreeSitterJson Handler Tests
//
// Tree-sitter grammar provider for JSON files.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  treeSitterJsonHandler,
  resetTreeSitterJsonCounter,
} from '../implementations/typescript/tree-sitter-json.impl.js';

describe('TreeSitterJson', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTreeSitterJsonCounter();
  });

  describe('initialize', () => {
    it('creates a grammar instance for JSON language', async () => {
      const result = await treeSitterJsonHandler.initialize!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBeDefined();
    });

    it('returns existing instance on repeated initialization', async () => {
      const first = await treeSitterJsonHandler.initialize!({}, storage);
      const second = await treeSitterJsonHandler.initialize!({}, storage);
      expect(second.instance).toBe(first.instance);
    });
  });

  describe('parse', () => {
    it('parses a simple JSON object', async () => {
      const source = '{"name": "test", "value": 42}';
      const result = await treeSitterJsonHandler.parse!(
        { source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const tree = JSON.parse(result.tree as string);
      expect(tree.type).toBe('source_file');
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].type).toBe('object');
    });

    it('parses a JSON array', async () => {
      const source = '[1, 2, 3]';
      const result = await treeSitterJsonHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      expect(tree.children[0].type).toBe('array');
      expect(tree.children[0].children.length).toBe(3);
    });

    it('parses nested JSON structures', async () => {
      const source = '{"nested": {"key": "value"}, "arr": [1, true, null]}';
      const result = await treeSitterJsonHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const obj = tree.children[0];
      expect(obj.type).toBe('object');
      expect(obj.children.length).toBe(2);
      // First pair: nested object
      expect(obj.children[0].type).toBe('pair');
    });

    it('identifies string, number, boolean, and null types', async () => {
      const source = '{"s": "hello", "n": 42, "b": true, "nil": null}';
      const result = await treeSitterJsonHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const pairs = tree.children[0].children;
      // Each pair has a key and a value child
      expect(pairs[0].children[1].type).toBe('string');
      expect(pairs[1].children[1].type).toBe('number');
      expect(pairs[2].children[1].type).toBe('boolean');
      expect(pairs[3].children[1].type).toBe('null');
    });

    it('returns parseError for invalid JSON', async () => {
      const result = await treeSitterJsonHandler.parse!(
        { source: '{invalid json}' },
        storage,
      );
      expect(result.variant).toBe('parseError');
    });
  });

  describe('highlight', () => {
    it('identifies property names and string values', async () => {
      const source = '{"key": "value"}';
      const result = await treeSitterJsonHandler.highlight!(
        { source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const highlights = JSON.parse(result.highlights as string);
      const properties = highlights.filter((h: any) => h.tokenType === 'property');
      const strings = highlights.filter((h: any) => h.tokenType === 'string');
      expect(properties.length).toBeGreaterThan(0);
      expect(strings.length).toBeGreaterThan(0);
    });

    it('identifies number highlights', async () => {
      const source = '{"count": 42}';
      const result = await treeSitterJsonHandler.highlight!(
        { source },
        storage,
      );
      const highlights = JSON.parse(result.highlights as string);
      const numbers = highlights.filter((h: any) => h.tokenType === 'number');
      expect(numbers.length).toBeGreaterThan(0);
    });

    it('identifies boolean and null highlights', async () => {
      const source = '{"flag": true, "nil": null}';
      const result = await treeSitterJsonHandler.highlight!(
        { source },
        storage,
      );
      const highlights = JSON.parse(result.highlights as string);
      const booleans = highlights.filter((h: any) => h.tokenType === 'boolean');
      const keywords = highlights.filter((h: any) => h.tokenType === 'keyword');
      expect(booleans.length).toBeGreaterThan(0);
      expect(keywords.length).toBeGreaterThan(0);
    });
  });

  describe('query', () => {
    it('queries for string nodes', async () => {
      const source = '{"a": "hello", "b": "world"}';
      const result = await treeSitterJsonHandler.query!(
        { pattern: '(string)', source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it('queries for pair nodes', async () => {
      const source = '{"x": 1, "y": 2}';
      const result = await treeSitterJsonHandler.query!(
        { pattern: '(pair)', source },
        storage,
      );
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBe(2);
    });
  });

  describe('register', () => {
    it('returns JSON language registration info', async () => {
      const result = await treeSitterJsonHandler.register!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.language).toBe('json');
      const extensions = JSON.parse(result.extensions as string);
      expect(extensions).toContain('.json');
    });
  });
});
