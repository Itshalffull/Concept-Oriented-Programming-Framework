// ============================================================
// EnrichmentRenderer Handler Tests
//
// Render opaque enrichment JSON into formatted output strings
// using data-driven templates. See Architecture doc Section 1.8.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  enrichmentRendererHandler,
  resetEnrichmentRendererCounter,
} from '../implementations/typescript/enrichment-renderer.impl.js';

describe('EnrichmentRenderer', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetEnrichmentRendererCounter();
  });

  describe('register', () => {
    it('registers a handler for a key/format pair', async () => {
      const result = await enrichmentRendererHandler.register!(
        {
          key: 'checklist',
          format: 'skill-md',
          order: 1,
          pattern: 'checklist',
          template: '{"title": "Checklist"}',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.handler).toBeDefined();
    });

    it('returns unknownPattern for unsupported pattern', async () => {
      const result = await enrichmentRendererHandler.register!(
        {
          key: 'test',
          format: 'md',
          order: 1,
          pattern: 'nonexistent-pattern',
          template: '{}',
        },
        storage,
      );
      expect(result.variant).toBe('unknownPattern');
    });

    it('returns invalidTemplate for non-JSON template', async () => {
      const result = await enrichmentRendererHandler.register!(
        {
          key: 'test',
          format: 'md',
          order: 1,
          pattern: 'list',
          template: 'not json',
        },
        storage,
      );
      expect(result.variant).toBe('invalidTemplate');
    });

    it('replaces existing handler for same key/format pair', async () => {
      await enrichmentRendererHandler.register!(
        { key: 'items', format: 'md', order: 1, pattern: 'list', template: '{}' },
        storage,
      );
      const result = await enrichmentRendererHandler.register!(
        { key: 'items', format: 'md', order: 2, pattern: 'checklist', template: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');
      // Should reuse existing ID
      const handlers = await storage.find('enrichment-renderer', { key: 'items', format: 'md' });
      expect(handlers.length).toBe(1);
    });
  });

  describe('render', () => {
    it('renders content using registered handlers', async () => {
      await enrichmentRendererHandler.register!(
        { key: 'steps', format: 'md', order: 1, pattern: 'checklist', template: '{"title": "Steps"}' },
        storage,
      );
      const result = await enrichmentRendererHandler.render!(
        {
          content: JSON.stringify({ steps: ['Step A', 'Step B'] }),
          format: 'md',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('- [ ] Step A');
      expect(output).toContain('- [ ] Step B');
    });

    it('renders list pattern', async () => {
      await enrichmentRendererHandler.register!(
        { key: 'items', format: 'md', order: 1, pattern: 'list', template: '{"title": "Items"}' },
        storage,
      );
      const result = await enrichmentRendererHandler.render!(
        { content: JSON.stringify({ items: ['Alpha', 'Beta'] }), format: 'md' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('- Alpha');
      expect(output).toContain('- Beta');
    });

    it('renders callout pattern', async () => {
      await enrichmentRendererHandler.register!(
        { key: 'warning', format: 'md', order: 1, pattern: 'callout', template: '{"kind": "warning"}' },
        storage,
      );
      const result = await enrichmentRendererHandler.render!(
        { content: JSON.stringify({ warning: 'Be careful!' }), format: 'md' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('> **WARNING**: Be careful!');
    });

    it('renders bad-good pattern', async () => {
      await enrichmentRendererHandler.register!(
        { key: 'practices', format: 'md', order: 1, pattern: 'bad-good', template: '{"title": "Practices"}' },
        storage,
      );
      const result = await enrichmentRendererHandler.render!(
        {
          content: JSON.stringify({
            practices: { bad: ['mutable globals'], good: ['pure functions'] },
          }),
          format: 'md',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      const output = result.output as string;
      expect(output).toContain('**Avoid:**');
      expect(output).toContain('**Prefer:**');
    });

    it('reports unhandled keys', async () => {
      await enrichmentRendererHandler.register!(
        { key: 'items', format: 'md', order: 1, pattern: 'list', template: '{}' },
        storage,
      );
      const result = await enrichmentRendererHandler.render!(
        { content: JSON.stringify({ items: ['a'], extra: 'b' }), format: 'md' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.unhandledKeys as string[]).length).toBe(1);
      expect(result.unhandledKeys).toContain('extra');
    });

    it('returns unknownFormat when no handlers exist for format', async () => {
      const result = await enrichmentRendererHandler.render!(
        { content: '{}', format: 'unknown-format' },
        storage,
      );
      expect(result.variant).toBe('unknownFormat');
    });

    it('returns invalidContent for non-JSON content', async () => {
      const result = await enrichmentRendererHandler.render!(
        { content: 'not json', format: 'md' },
        storage,
      );
      expect(result.variant).toBe('invalidContent');
    });
  });

  describe('listHandlers', () => {
    it('lists registered handler keys for a format', async () => {
      await enrichmentRendererHandler.register!(
        { key: 'steps', format: 'md', order: 1, pattern: 'checklist', template: '{}' },
        storage,
      );
      await enrichmentRendererHandler.register!(
        { key: 'links', format: 'md', order: 2, pattern: 'link-list', template: '{}' },
        storage,
      );

      const result = await enrichmentRendererHandler.listHandlers!(
        { format: 'md' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(2);
      expect((result.handlers as string[])).toContain('steps');
      expect((result.handlers as string[])).toContain('links');
    });
  });

  describe('listPatterns', () => {
    it('returns all built-in render patterns', async () => {
      const result = await enrichmentRendererHandler.listPatterns!({}, storage);
      expect(result.variant).toBe('ok');
      const patterns = result.patterns as string[];
      expect(patterns).toContain('list');
      expect(patterns).toContain('checklist');
      expect(patterns).toContain('callout');
      expect(patterns).toContain('bad-good');
      expect(patterns).toContain('heading-body');
    });
  });
});
