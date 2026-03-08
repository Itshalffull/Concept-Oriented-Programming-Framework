// ComponentMapping concept handler tests — admin-configured widget bindings.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  componentMappingHandler,
  resetComponentMappingCounter,
} from '../handlers/ts/component-mapping.handler.js';

describe('ComponentMapping', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetComponentMappingCounter();
  });

  describe('create', () => {
    it('creates a mapping for a schema+display_mode pair', async () => {
      const result = await componentMappingHandler.create(
        { name: 'Article Card', widget_id: 'card', schema: 'Article', display_mode: 'teaser' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.mapping).toBe('mapping-1');
    });

    it('rejects duplicate schema+display_mode combinations', async () => {
      await componentMappingHandler.create(
        { name: 'Article Card', widget_id: 'card', schema: 'Article', display_mode: 'teaser' },
        storage,
      );
      const result = await componentMappingHandler.create(
        { name: 'Article Card v2', widget_id: 'card2', schema: 'Article', display_mode: 'teaser' },
        storage,
      );
      expect(result.variant).toBe('invalid');
    });

    it('allows different schema+display_mode combinations', async () => {
      const r1 = await componentMappingHandler.create(
        { name: 'Article Card', widget_id: 'card', schema: 'Article', display_mode: 'teaser' },
        storage,
      );
      const r2 = await componentMappingHandler.create(
        { name: 'Article Full', widget_id: 'full', schema: 'Article', display_mode: 'full' },
        storage,
      );
      expect(r1.variant).toBe('ok');
      expect(r2.variant).toBe('ok');
    });
  });

  describe('bindSlot', () => {
    it('binds sources to a slot on a mapping', async () => {
      const created = await componentMappingHandler.create(
        { name: 'Card', widget_id: 'card', schema: 'Article', display_mode: 'teaser' },
        storage,
      );
      const result = await componentMappingHandler.bindSlot(
        { mapping: created.mapping, slot_name: 'header', sources: ['title', 'subtitle'] },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns notfound for non-existent mapping', async () => {
      const result = await componentMappingHandler.bindSlot(
        { mapping: 'nonexistent', slot_name: 'header', sources: ['title'] },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('bindProp', () => {
    it('binds a source to a prop on a mapping', async () => {
      const created = await componentMappingHandler.create(
        { name: 'Card', widget_id: 'card', schema: 'Article', display_mode: 'teaser' },
        storage,
      );
      const result = await componentMappingHandler.bindProp(
        { mapping: created.mapping, prop_name: 'showImage', source: 'static:true' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns notfound for non-existent mapping', async () => {
      const result = await componentMappingHandler.bindProp(
        { mapping: 'nonexistent', prop_name: 'showImage', source: 'static:true' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('render', () => {
    it('produces a render tree with resolved slots and props', async () => {
      const created = await componentMappingHandler.create(
        { name: 'Card', widget_id: 'card', schema: 'Article', display_mode: 'teaser' },
        storage,
      );
      await componentMappingHandler.bindSlot(
        { mapping: created.mapping, slot_name: 'header', sources: ['title'] },
        storage,
      );
      await componentMappingHandler.bindProp(
        { mapping: created.mapping, prop_name: 'showImage', source: 'static:true' },
        storage,
      );

      const result = await componentMappingHandler.render(
        { mapping: created.mapping, context: '{"entity_id":"article-1"}' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const tree = JSON.parse(result.render_tree as string);
      expect(tree.widget_id).toBe('card');
      expect(tree.slots).toHaveLength(1);
      expect(tree.slots[0].name).toBe('header');
      expect(tree.props).toHaveLength(1);
      expect(tree.props[0].name).toBe('showImage');
    });

    it('returns notfound for non-existent mapping', async () => {
      const result = await componentMappingHandler.render(
        { mapping: 'nonexistent', context: '{}' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('preview', () => {
    it('generates a preview for an entity', async () => {
      const created = await componentMappingHandler.create(
        { name: 'Card', widget_id: 'card', schema: 'Article', display_mode: 'teaser' },
        storage,
      );
      const result = await componentMappingHandler.preview(
        { mapping: created.mapping, entity_id: 'article-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.preview).toBeDefined();
    });

    it('returns notfound for non-existent mapping', async () => {
      const result = await componentMappingHandler.preview(
        { mapping: 'nonexistent', entity_id: 'article-1' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('lookup', () => {
    it('finds mapping by schema+display_mode', async () => {
      const created = await componentMappingHandler.create(
        { name: 'Article Card', widget_id: 'card', schema: 'Article', display_mode: 'teaser' },
        storage,
      );
      const result = await componentMappingHandler.lookup(
        { schema: 'Article', display_mode: 'teaser' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.mapping).toBe(created.mapping);
    });

    it('returns notfound for non-existent combination', async () => {
      const result = await componentMappingHandler.lookup(
        { schema: 'NonExistent', display_mode: 'full' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('delete', () => {
    it('removes a mapping and its bindings', async () => {
      const created = await componentMappingHandler.create(
        { name: 'Card', widget_id: 'card', schema: 'Article', display_mode: 'teaser' },
        storage,
      );
      await componentMappingHandler.bindSlot(
        { mapping: created.mapping, slot_name: 'header', sources: ['title'] },
        storage,
      );

      const deleteResult = await componentMappingHandler.delete(
        { mapping: created.mapping },
        storage,
      );
      expect(deleteResult.variant).toBe('ok');

      // Verify lookup fails after deletion
      const lookupResult = await componentMappingHandler.lookup(
        { schema: 'Article', display_mode: 'teaser' },
        storage,
      );
      expect(lookupResult.variant).toBe('notfound');
    });

    it('returns notfound for non-existent mapping', async () => {
      const result = await componentMappingHandler.delete(
        { mapping: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('invariant: create then lookup', () => {
    it('after create, lookup returns the same mapping', async () => {
      const created = await componentMappingHandler.create(
        { name: 'Article Card', widget_id: 'card', schema: 'Article', display_mode: 'teaser' },
        storage,
      );
      expect(created.variant).toBe('ok');

      const looked = await componentMappingHandler.lookup(
        { schema: 'Article', display_mode: 'teaser' },
        storage,
      );
      expect(looked.variant).toBe('ok');
      expect(looked.mapping).toBe(created.mapping);
    });
  });

  describe('invariant: create then delete then lookup', () => {
    it('after create and delete, lookup returns notfound', async () => {
      const created = await componentMappingHandler.create(
        { name: 'Test Mapping', widget_id: 'card', schema: 'Test', display_mode: 'full' },
        storage,
      );
      expect(created.variant).toBe('ok');

      const deleted = await componentMappingHandler.delete(
        { mapping: created.mapping },
        storage,
      );
      expect(deleted.variant).toBe('ok');

      const looked = await componentMappingHandler.lookup(
        { schema: 'Test', display_mode: 'full' },
        storage,
      );
      expect(looked.variant).toBe('notfound');
    });
  });
});
