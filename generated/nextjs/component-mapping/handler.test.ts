// ComponentMapping — handler.test.ts
// Unit tests for component mapping CRUD, slot/prop binding, render, preview, lookup, and delete.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { componentMappingHandler } from './handler.js';
import type { ComponentMappingStorage } from './types.js';

const createTestStorage = (): ComponentMappingStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation, filter?) => {
      const all = [...(store.get(relation)?.values() ?? [])];
      if (!filter) return all;
      return all.filter((record) =>
        Object.entries(filter).every(([k, v]) => record[k] === v),
      );
    },
  };
};

const createFailingStorage = (): ComponentMappingStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ComponentMapping handler', () => {
  describe('create', () => {
    it('creates a new mapping with ok variant', async () => {
      const storage = createTestStorage();
      const result = await componentMappingHandler.create(
        { name: 'TaskCard', widget_id: 'widget-task', schema: 'Task', display_mode: 'card' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).mapping).toBeDefined();
      }
    });

    it('returns invalid when name is empty', async () => {
      const storage = createTestStorage();
      const result = await componentMappingHandler.create(
        { name: '', widget_id: 'widget-task', schema: 'Task', display_mode: 'card' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await componentMappingHandler.create(
        { name: 'TaskCard', widget_id: 'w1', schema: 'Task', display_mode: 'card' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('bindSlot', () => {
    it('binds a slot to an existing mapping with ok variant', async () => {
      const storage = createTestStorage();
      const createResult = await componentMappingHandler.create(
        { name: 'TaskCard', widget_id: 'w1', schema: 'Task', display_mode: 'card' },
        storage,
      )();
      const mappingId = (createResult as any).right.mapping;

      const result = await componentMappingHandler.bindSlot(
        { mapping: mappingId, slot_name: 'header', sources: ['title', 'status'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound for non-existent mapping', async () => {
      const storage = createTestStorage();
      const result = await componentMappingHandler.bindSlot(
        { mapping: 'nonexistent', slot_name: 'header', sources: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('bindProp', () => {
    it('binds a prop to an existing mapping with ok variant', async () => {
      const storage = createTestStorage();
      const createResult = await componentMappingHandler.create(
        { name: 'TaskCard', widget_id: 'w1', schema: 'Task', display_mode: 'card' },
        storage,
      )();
      const mappingId = (createResult as any).right.mapping;

      const result = await componentMappingHandler.bindProp(
        { mapping: mappingId, prop_name: 'color', source: 'status_color' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound for non-existent mapping', async () => {
      const storage = createTestStorage();
      const result = await componentMappingHandler.bindProp(
        { mapping: 'nonexistent', prop_name: 'color', source: 'x' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('render', () => {
    it('renders an existing mapping with ok variant', async () => {
      const storage = createTestStorage();
      const createResult = await componentMappingHandler.create(
        { name: 'TaskCard', widget_id: 'w1', schema: 'Task', display_mode: 'card' },
        storage,
      )();
      const mappingId = (createResult as any).right.mapping;

      const result = await componentMappingHandler.render(
        { mapping: mappingId, context: '{"entity_id":"task-1"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).render_tree).toBeDefined();
      }
    });

    it('returns notfound for non-existent mapping', async () => {
      const storage = createTestStorage();
      const result = await componentMappingHandler.render(
        { mapping: 'nonexistent', context: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('preview', () => {
    it('previews an existing mapping with ok variant', async () => {
      const storage = createTestStorage();
      const createResult = await componentMappingHandler.create(
        { name: 'TaskCard', widget_id: 'w1', schema: 'Task', display_mode: 'card' },
        storage,
      )();
      const mappingId = (createResult as any).right.mapping;

      const result = await componentMappingHandler.preview(
        { mapping: mappingId, entity_id: 'task-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).preview).toBeDefined();
      }
    });

    it('returns notfound for non-existent mapping', async () => {
      const storage = createTestStorage();
      const result = await componentMappingHandler.preview(
        { mapping: 'nonexistent', entity_id: 'task-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('lookup', () => {
    it('looks up an existing mapping by schema+display_mode with ok variant', async () => {
      const storage = createTestStorage();
      const createResult = await componentMappingHandler.create(
        { name: 'TaskCard', widget_id: 'w1', schema: 'Task', display_mode: 'card' },
        storage,
      )();
      expect(E.isRight(createResult)).toBe(true);

      const result = await componentMappingHandler.lookup(
        { schema: 'Task', display_mode: 'card' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound for non-existent schema+display_mode', async () => {
      const storage = createTestStorage();
      const result = await componentMappingHandler.lookup(
        { schema: 'Unknown', display_mode: 'list' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('delete', () => {
    it('deletes an existing mapping with ok variant', async () => {
      const storage = createTestStorage();
      const createResult = await componentMappingHandler.create(
        { name: 'TaskCard', widget_id: 'w1', schema: 'Task', display_mode: 'card' },
        storage,
      )();
      const mappingId = (createResult as any).right.mapping;

      const result = await componentMappingHandler.delete(
        { mapping: mappingId },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound for non-existent mapping', async () => {
      const storage = createTestStorage();
      const result = await componentMappingHandler.delete(
        { mapping: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('multi-step sequence: create -> bindSlot -> bindProp -> render -> delete', () => {
    it('completes full lifecycle', async () => {
      const storage = createTestStorage();

      const createResult = await componentMappingHandler.create(
        { name: 'UserProfile', widget_id: 'w-profile', schema: 'User', display_mode: 'detail' },
        storage,
      )();
      expect(E.isRight(createResult)).toBe(true);
      const mappingId = (createResult as any).right.mapping;

      const slotResult = await componentMappingHandler.bindSlot(
        { mapping: mappingId, slot_name: 'avatar', sources: ['profile_image'] },
        storage,
      )();
      expect(E.isRight(slotResult)).toBe(true);

      const propResult = await componentMappingHandler.bindProp(
        { mapping: mappingId, prop_name: 'size', source: 'large' },
        storage,
      )();
      expect(E.isRight(propResult)).toBe(true);

      const renderResult = await componentMappingHandler.render(
        { mapping: mappingId, context: '{"entity_id":"user-1"}' },
        storage,
      )();
      expect(E.isRight(renderResult)).toBe(true);
      if (E.isRight(renderResult)) {
        expect(renderResult.right.variant).toBe('ok');
        const tree = JSON.parse((renderResult.right as any).render_tree);
        expect(tree.slots.length).toBe(1);
        expect(tree.props.length).toBe(1);
      }

      const deleteResult = await componentMappingHandler.delete(
        { mapping: mappingId },
        storage,
      )();
      expect(E.isRight(deleteResult)).toBe(true);
      if (E.isRight(deleteResult)) {
        expect(deleteResult.right.variant).toBe('ok');
      }
    });
  });

  describe('storage failure', () => {
    it('propagates storage errors on lookup', async () => {
      const storage = createFailingStorage();
      const result = await componentMappingHandler.lookup(
        { schema: 'Task', display_mode: 'card' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
