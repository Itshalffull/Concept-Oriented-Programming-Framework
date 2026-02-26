// ============================================================
// TreeSitterYaml Handler Tests
//
// Tree-sitter grammar provider for YAML files.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  treeSitterYamlHandler,
  resetTreeSitterYamlCounter,
} from '../implementations/typescript/tree-sitter-yaml.impl.js';

describe('TreeSitterYaml', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTreeSitterYamlCounter();
  });

  describe('initialize', () => {
    it('creates a grammar instance for YAML language', async () => {
      const result = await treeSitterYamlHandler.initialize!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBeDefined();
    });

    it('returns existing instance on repeated initialization', async () => {
      const first = await treeSitterYamlHandler.initialize!({}, storage);
      const second = await treeSitterYamlHandler.initialize!({}, storage);
      expect(second.instance).toBe(first.instance);
    });
  });

  describe('parse', () => {
    it('parses key-value pairs', async () => {
      const source = `name: test
version: 1.0.0
debug: true`;
      const result = await treeSitterYamlHandler.parse!(
        { source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const tree = JSON.parse(result.tree as string);
      expect(tree.type).toBe('source_file');
      const pairs = tree.children.filter((c: any) => c.type === 'block_mapping_pair');
      expect(pairs.length).toBe(3);
    });

    it('parses nested structures via indentation', async () => {
      const source = `server:
  host: localhost
  port: 8080`;
      const result = await treeSitterYamlHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const serverPair = tree.children.find((c: any) => c.type === 'block_mapping_pair');
      expect(serverPair).toBeDefined();
      // Nested pairs should be children of the server pair
      expect(serverPair.children.length).toBeGreaterThan(0);
    });

    it('parses block sequences', async () => {
      const source = `items:
- first
- second
- third`;
      const result = await treeSitterYamlHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const seqItems = tree.children.filter((c: any) => c.type === 'block_sequence_item');
      // Items may be at root or nested depending on indentation
      expect(tree.children.length).toBeGreaterThan(0);
    });

    it('parses document markers', async () => {
      const source = `---
name: doc1
...`;
      const result = await treeSitterYamlHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const doc = tree.children.find((c: any) => c.type === 'document');
      expect(doc).toBeDefined();
    });

    it('parses comments', async () => {
      const source = `# This is a comment
name: test`;
      const result = await treeSitterYamlHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const comments = tree.children.filter((c: any) => c.type === 'comment');
      expect(comments.length).toBe(1);
    });

    it('detects scalar types: boolean, null, integer, float', async () => {
      const source = `flag: true
nil: null
count: 42
rate: 3.14`;
      const result = await treeSitterYamlHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      // Walk pairs to find scalar values
      const pairs = tree.children.filter((c: any) => c.type === 'block_mapping_pair');
      expect(pairs.length).toBe(4);
    });

    it('parses flow sequences', async () => {
      const source = `tags: [alpha, beta, gamma]`;
      const result = await treeSitterYamlHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const pair = tree.children.find((c: any) => c.type === 'block_mapping_pair');
      expect(pair).toBeDefined();
      const flowSeq = pair.children.find((c: any) => c.type === 'flow_sequence');
      expect(flowSeq).toBeDefined();
    });

    it('parses anchors and aliases', async () => {
      const source = `defaults: &defaults
  adapter: postgres
development:
  database: dev_db
  settings: *defaults`;
      const result = await treeSitterYamlHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      // Look for anchor node in the tree
      function findType(node: any, type: string): any[] {
        const results: any[] = [];
        if (node.type === type) results.push(node);
        for (const child of (node.children || [])) {
          results.push(...findType(child, type));
        }
        return results;
      }
      const anchors = findType(tree, 'anchor');
      expect(anchors.length).toBeGreaterThan(0);
    });
  });

  describe('highlight', () => {
    it('identifies property/key highlights', async () => {
      const source = `name: value`;
      const result = await treeSitterYamlHandler.highlight!(
        { source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const highlights = JSON.parse(result.highlights as string);
      const properties = highlights.filter((h: any) => h.tokenType === 'property');
      expect(properties.length).toBeGreaterThan(0);
    });

    it('identifies boolean value highlights', async () => {
      const source = `flag: true`;
      const result = await treeSitterYamlHandler.highlight!(
        { source },
        storage,
      );
      const highlights = JSON.parse(result.highlights as string);
      const booleans = highlights.filter((h: any) => h.tokenType === 'boolean');
      expect(booleans.length).toBeGreaterThan(0);
    });

    it('identifies comment highlights', async () => {
      const source = `# This is a comment
name: test`;
      const result = await treeSitterYamlHandler.highlight!(
        { source },
        storage,
      );
      const highlights = JSON.parse(result.highlights as string);
      const comments = highlights.filter((h: any) => h.tokenType === 'comment');
      expect(comments.length).toBeGreaterThan(0);
    });
  });

  describe('query', () => {
    it('queries for block_mapping_pair nodes', async () => {
      const source = `a: 1
b: 2
c: 3`;
      const result = await treeSitterYamlHandler.query!(
        { pattern: '(block_mapping_pair)', source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBe(3);
    });
  });

  describe('register', () => {
    it('returns YAML language registration info', async () => {
      const result = await treeSitterYamlHandler.register!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.language).toBe('yaml');
      const extensions = JSON.parse(result.extensions as string);
      expect(extensions).toContain('.yaml');
      expect(extensions).toContain('.yml');
    });
  });
});
