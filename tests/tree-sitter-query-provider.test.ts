// ============================================================
// TreeSitterQueryProvider Handler Tests
//
// Pattern engine provider for Tree-sitter S-expression queries.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  treeSitterQueryProviderHandler,
  resetTreeSitterQueryProviderCounter,
} from '../handlers/ts/tree-sitter-query-provider.handler.js';

describe('TreeSitterQueryProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTreeSitterQueryProviderCounter();
  });

  describe('initialize', () => {
    it('creates a query provider instance', async () => {
      const result = await treeSitterQueryProviderHandler.initialize!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBeDefined();
    });

    it('returns existing instance on repeated initialization', async () => {
      const first = await treeSitterQueryProviderHandler.initialize!({}, storage);
      const second = await treeSitterQueryProviderHandler.initialize!({}, storage);
      expect(second.instance).toBe(first.instance);
    });
  });

  describe('execute', () => {
    const sampleTree = JSON.stringify({
      type: 'source_file',
      text: '',
      startLine: 0,
      startCol: 0,
      endLine: 5,
      endCol: 0,
      children: [
        {
          type: 'function_declaration',
          text: 'function add(a, b)',
          startLine: 0,
          startCol: 0,
          endLine: 0,
          endCol: 20,
          children: [
            {
              type: 'function_name',
              text: 'add',
              startLine: 0,
              startCol: 9,
              endLine: 0,
              endCol: 12,
              children: [],
            },
          ],
        },
        {
          type: 'function_declaration',
          text: 'function sub(a, b)',
          startLine: 2,
          startCol: 0,
          endLine: 2,
          endCol: 20,
          children: [
            {
              type: 'function_name',
              text: 'sub',
              startLine: 2,
              startCol: 9,
              endLine: 2,
              endCol: 12,
              children: [],
            },
          ],
        },
      ],
    });

    it('matches nodes by type', async () => {
      const result = await treeSitterQueryProviderHandler.execute!(
        { pattern: '(function_declaration)', tree: sampleTree },
        storage,
      );
      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBe(2);
    });

    it('captures named nodes with @name syntax', async () => {
      // The @name capture inside (function_name @name) captures the
      // function_name child node. When placed outside the child
      // parentheses, it captures the parent node instead.
      const result = await treeSitterQueryProviderHandler.execute!(
        { pattern: '(function_declaration (function_name @name))', tree: sampleTree },
        storage,
      );
      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBe(2);
      expect(matches[0].captures.name).toBeDefined();
      expect(matches[0].captures.name.text).toBe('add');
    });

    it('matches with wildcard type (_)', async () => {
      const treeWithWildcard = JSON.stringify({
        type: 'source_file',
        text: '',
        startLine: 0,
        startCol: 0,
        endLine: 0,
        endCol: 0,
        children: [
          {
            type: 'any_node',
            text: 'test',
            startLine: 0,
            startCol: 0,
            endLine: 0,
            endCol: 4,
            children: [],
          },
        ],
      });
      const result = await treeSitterQueryProviderHandler.execute!(
        { pattern: '(_)', tree: treeWithWildcard },
        storage,
      );
      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      // Wildcard matches every node
      expect(matches.length).toBeGreaterThan(0);
    });

    it('returns invalidPattern for empty pattern', async () => {
      const result = await treeSitterQueryProviderHandler.execute!(
        { pattern: '', tree: sampleTree },
        storage,
      );
      expect(result.variant).toBe('invalidPattern');
    });

    it('returns invalidPattern for unbalanced parentheses', async () => {
      const result = await treeSitterQueryProviderHandler.execute!(
        { pattern: '(function_declaration', tree: sampleTree },
        storage,
      );
      expect(result.variant).toBe('invalidPattern');
    });

    it('returns invalidPattern for non-S-expression pattern', async () => {
      const result = await treeSitterQueryProviderHandler.execute!(
        { pattern: 'not an s-expression', tree: sampleTree },
        storage,
      );
      expect(result.variant).toBe('invalidPattern');
    });

    it('returns invalidPattern for invalid tree JSON', async () => {
      const result = await treeSitterQueryProviderHandler.execute!(
        { pattern: '(function_declaration)', tree: '{not valid json' },
        storage,
      );
      expect(result.variant).toBe('invalidPattern');
    });

    it('returns empty matches when no nodes match the type', async () => {
      const result = await treeSitterQueryProviderHandler.execute!(
        { pattern: '(class_declaration)', tree: sampleTree },
        storage,
      );
      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBe(0);
    });

    it('supports text matching in patterns', async () => {
      const result = await treeSitterQueryProviderHandler.execute!(
        { pattern: '(function_name "add")', tree: sampleTree },
        storage,
      );
      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBe(1);
    });
  });
});
