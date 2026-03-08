// SlotSource concept handler tests — pluggable data source resolution.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  slotSourceHandler,
  resetSlotSourceCounter,
} from '../handlers/ts/slot-source.handler.js';

describe('SlotSource', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSlotSourceCounter();
  });

  describe('register', () => {
    it('registers a provider for a source type', async () => {
      const result = await slotSourceHandler.register(
        { source_type: 'static_value', provider: 'static-provider' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('rejects duplicate registration for same source type', async () => {
      await slotSourceHandler.register(
        { source_type: 'static_value', provider: 'static-provider' },
        storage,
      );
      const result = await slotSourceHandler.register(
        { source_type: 'static_value', provider: 'other-provider' },
        storage,
      );
      expect(result.variant).toBe('already_registered');
      expect(result.source_type).toBe('static_value');
    });

    it('allows registration of different source types', async () => {
      const r1 = await slotSourceHandler.register(
        { source_type: 'static_value', provider: 'static-provider' },
        storage,
      );
      const r2 = await slotSourceHandler.register(
        { source_type: 'entity_field', provider: 'entity-provider' },
        storage,
      );
      expect(r1.variant).toBe('ok');
      expect(r2.variant).toBe('ok');
    });
  });

  describe('resolve', () => {
    it('resolves a static_value source', async () => {
      await slotSourceHandler.register(
        { source_type: 'static_value', provider: 'static-provider' },
        storage,
      );
      const result = await slotSourceHandler.resolve(
        {
          source_type: 'static_value',
          config: '{"value": "Hello"}',
          context: '{}',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.data).toBe('Hello');
    });

    it('resolves an entity_field source', async () => {
      await slotSourceHandler.register(
        { source_type: 'entity_field', provider: 'entity-provider' },
        storage,
      );
      const result = await slotSourceHandler.resolve(
        {
          source_type: 'entity_field',
          config: '{"field": "title"}',
          context: '{"entity_id": "article-1"}',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      const data = JSON.parse(result.data as string);
      expect(data.field).toBe('title');
      expect(data.entity_id).toBe('article-1');
    });

    it('resolves a widget_embed source', async () => {
      await slotSourceHandler.register(
        { source_type: 'widget_embed', provider: 'widget-provider' },
        storage,
      );
      const result = await slotSourceHandler.resolve(
        {
          source_type: 'widget_embed',
          config: '{"widget_id": "card"}',
          context: '{"entity_id": "article-1"}',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      const data = JSON.parse(result.data as string);
      expect(data.widget_id).toBe('card');
    });

    it('returns error for unregistered source type', async () => {
      const result = await slotSourceHandler.resolve(
        {
          source_type: 'unknown_type',
          config: '{}',
          context: '{}',
        },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('No provider registered');
    });

    it('returns error for invalid config JSON', async () => {
      await slotSourceHandler.register(
        { source_type: 'static_value', provider: 'static-provider' },
        storage,
      );
      const result = await slotSourceHandler.resolve(
        {
          source_type: 'static_value',
          config: 'not-json',
          context: '{}',
        },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('Invalid config JSON');
    });

    it('returns error for invalid context JSON', async () => {
      await slotSourceHandler.register(
        { source_type: 'static_value', provider: 'static-provider' },
        storage,
      );
      const result = await slotSourceHandler.resolve(
        {
          source_type: 'static_value',
          config: '{"value": "Hi"}',
          context: 'bad-context',
        },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('Invalid context JSON');
    });
  });

  describe('process', () => {
    it('applies truncate processor', async () => {
      const longString = 'A'.repeat(200);
      const result = await slotSourceHandler.process(
        { data: longString, processors: ['truncate'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.result as string).length).toBeLessThan(200);
      expect((result.result as string).endsWith('...')).toBe(true);
    });

    it('applies strip_html processor', async () => {
      const result = await slotSourceHandler.process(
        { data: '<p>Hello <b>World</b></p>', processors: ['strip_html'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.result).toBe('Hello World');
    });

    it('applies fallback processor to empty data', async () => {
      const result = await slotSourceHandler.process(
        { data: '', processors: ['fallback'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.result).toBe('(no value)');
    });

    it('chains multiple processors in order', async () => {
      const result = await slotSourceHandler.process(
        { data: '<p>Hello</p>', processors: ['strip_html', 'truncate'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.result).toBe('Hello');
    });

    it('passes through data with no matching processors', async () => {
      const result = await slotSourceHandler.process(
        { data: 'unchanged', processors: ['date_format'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.result).toBe('unchanged');
    });
  });

  describe('invariant: register then resolve', () => {
    it('after registering static_value, resolve succeeds', async () => {
      const reg = await slotSourceHandler.register(
        { source_type: 'static_value', provider: 'static-provider' },
        storage,
      );
      expect(reg.variant).toBe('ok');

      const res = await slotSourceHandler.resolve(
        {
          source_type: 'static_value',
          config: '{"value": "Hello"}',
          context: '{}',
        },
        storage,
      );
      expect(res.variant).toBe('ok');
      expect(res.data).toBeDefined();
    });
  });
});
