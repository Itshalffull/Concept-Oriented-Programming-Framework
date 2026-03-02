// View — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { viewHandler } from './handler.js';
import type { ViewStorage } from './types.js';

const createTestStorage = (): ViewStorage => {
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

const createFailingStorage = (): ViewStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = viewHandler;

describe('View handler', () => {
  describe('create', () => {
    it('should create a new view', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { view: 'tasks', dataSource: 'tasks-table', layout: 'table' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.view).toBe('tasks');
        }
      }
    });

    it('should return error when view already exists', async () => {
      const storage = createTestStorage();
      await handler.create(
        { view: 'dup', dataSource: 'ds', layout: 'grid' },
        storage,
      )();
      const result = await handler.create(
        { view: 'dup', dataSource: 'ds2', layout: 'table' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should default to table layout for invalid layout', async () => {
      const storage = createTestStorage();
      await handler.create(
        { view: 'defaults', dataSource: 'ds', layout: 'invalid-layout' },
        storage,
      )();
      const stored = await storage.get('view', 'defaults');
      expect(stored).not.toBeNull();
      expect(stored!.layout).toBe('table');
    });

    it('should accept valid layout types', async () => {
      const storage = createTestStorage();
      await handler.create(
        { view: 'kanban-view', dataSource: 'ds', layout: 'kanban' },
        storage,
      )();
      const stored = await storage.get('view', 'kanban-view');
      expect(stored!.layout).toBe('kanban');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.create(
        { view: 'fail', dataSource: 'ds', layout: 'table' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setFilter', () => {
    it('should set a filter on an existing view', async () => {
      const storage = createTestStorage();
      await handler.create({ view: 'filterable', dataSource: 'ds', layout: 'table' }, storage)();
      const result = await handler.setFilter(
        { view: 'filterable', filter: 'status = active' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing view', async () => {
      const storage = createTestStorage();
      const result = await handler.setFilter(
        { view: 'nonexistent', filter: 'any' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('setSort', () => {
    it('should set sort order on an existing view', async () => {
      const storage = createTestStorage();
      await handler.create({ view: 'sortable', dataSource: 'ds', layout: 'table' }, storage)();
      const result = await handler.setSort(
        { view: 'sortable', sort: 'created_at DESC' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing view', async () => {
      const storage = createTestStorage();
      const result = await handler.setSort(
        { view: 'nope', sort: 'any' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('setGroup', () => {
    it('should set grouping on an existing view', async () => {
      const storage = createTestStorage();
      await handler.create({ view: 'groupable', dataSource: 'ds', layout: 'kanban' }, storage)();
      const result = await handler.setGroup(
        { view: 'groupable', group: 'status' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing view', async () => {
      const storage = createTestStorage();
      const result = await handler.setGroup(
        { view: 'nope', group: 'status' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('setVisibleFields', () => {
    it('should set visible fields on an existing view', async () => {
      const storage = createTestStorage();
      await handler.create({ view: 'field-view', dataSource: 'ds', layout: 'table' }, storage)();
      const result = await handler.setVisibleFields(
        { view: 'field-view', fields: 'name,email,status' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing view', async () => {
      const storage = createTestStorage();
      const result = await handler.setVisibleFields(
        { view: 'nope', fields: 'name' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('changeLayout', () => {
    it('should change layout on an existing view', async () => {
      const storage = createTestStorage();
      await handler.create({ view: 'layout-view', dataSource: 'ds', layout: 'table' }, storage)();
      const result = await handler.changeLayout(
        { view: 'layout-view', layout: 'grid' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
      const stored = await storage.get('view', 'layout-view');
      expect(stored!.layout).toBe('grid');
    });

    it('should keep existing layout for invalid layout value', async () => {
      const storage = createTestStorage();
      await handler.create({ view: 'keep-layout', dataSource: 'ds', layout: 'kanban' }, storage)();
      await handler.changeLayout(
        { view: 'keep-layout', layout: 'bogus' },
        storage,
      )();
      const stored = await storage.get('view', 'keep-layout');
      expect(stored!.layout).toBe('kanban');
    });

    it('should return notfound for missing view', async () => {
      const storage = createTestStorage();
      const result = await handler.changeLayout(
        { view: 'nope', layout: 'grid' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('duplicate', () => {
    it('should duplicate an existing view with a new name', async () => {
      const storage = createTestStorage();
      await handler.create({ view: 'original', dataSource: 'ds', layout: 'list' }, storage)();
      const result = await handler.duplicate(
        { view: 'original' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.newView).toContain('original-copy-');
        }
      }
    });

    it('should return notfound for missing view', async () => {
      const storage = createTestStorage();
      const result = await handler.duplicate(
        { view: 'nope' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('embed', () => {
    it('should generate embed code for an existing view', async () => {
      const storage = createTestStorage();
      await handler.create({ view: 'embed-view', dataSource: 'items', layout: 'gallery' }, storage)();
      const result = await handler.embed(
        { view: 'embed-view' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.embedCode).toContain('clef-view');
          expect(result.right.embedCode).toContain('embed-view');
          expect(result.right.embedCode).toContain('gallery');
          expect(result.right.embedCode).toContain('items');
        }
      }
    });

    it('should return notfound for missing view', async () => {
      const storage = createTestStorage();
      const result = await handler.embed(
        { view: 'nope' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
