// View Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const viewHandler: ConceptHandler = {
  async create(input, storage) {
    const view = input.view as string;
    const dataSource = input.dataSource as string;
    const layout = input.layout as string;

    const existing = await storage.get('view', view);
    if (existing) {
      return { variant: 'error', message: 'View already exists' };
    }

    await storage.put('view', view, {
      view,
      dataSource,
      layout,
      filters: '',
      sorts: '',
      groups: '',
      visibleFields: '',
      formatting: '',
    });

    return { variant: 'ok', view };
  },

  async setFilter(input, storage) {
    const view = input.view as string;
    const filter = input.filter as string;

    const existing = await storage.get('view', view);
    if (!existing) {
      return { variant: 'notfound', message: 'View not found' };
    }

    await storage.put('view', view, {
      ...existing,
      filters: filter,
    });

    return { variant: 'ok', view };
  },

  async setSort(input, storage) {
    const view = input.view as string;
    const sort = input.sort as string;

    const existing = await storage.get('view', view);
    if (!existing) {
      return { variant: 'notfound', message: 'View not found' };
    }

    await storage.put('view', view, {
      ...existing,
      sorts: sort,
    });

    return { variant: 'ok', view };
  },

  async setGroup(input, storage) {
    const view = input.view as string;
    const group = input.group as string;

    const existing = await storage.get('view', view);
    if (!existing) {
      return { variant: 'notfound', message: 'View not found' };
    }

    await storage.put('view', view, {
      ...existing,
      groups: group,
    });

    return { variant: 'ok', view };
  },

  async setVisibleFields(input, storage) {
    const view = input.view as string;
    const fields = input.fields as string;

    const existing = await storage.get('view', view);
    if (!existing) {
      return { variant: 'notfound', message: 'View not found' };
    }

    await storage.put('view', view, {
      ...existing,
      visibleFields: fields,
    });

    return { variant: 'ok', view };
  },

  async changeLayout(input, storage) {
    const view = input.view as string;
    const layout = input.layout as string;

    const existing = await storage.get('view', view);
    if (!existing) {
      return { variant: 'notfound', message: 'View not found' };
    }

    await storage.put('view', view, {
      ...existing,
      layout,
    });

    return { variant: 'ok', view };
  },

  async duplicate(input, storage) {
    const view = input.view as string;

    const existing = await storage.get('view', view);
    if (!existing) {
      return { variant: 'notfound', message: 'View not found' };
    }

    const newView = `${view}-copy-${Date.now()}`;

    await storage.put('view', newView, {
      ...existing,
      view: newView,
    });

    return { variant: 'ok', newView };
  },

  async embed(input, storage) {
    const view = input.view as string;

    const existing = await storage.get('view', view);
    if (!existing) {
      return { variant: 'notfound', message: 'View not found' };
    }

    const embedCode = JSON.stringify({
      type: 'embed',
      view,
      dataSource: existing.dataSource,
      layout: existing.layout,
      filters: existing.filters,
      sorts: existing.sorts,
      groups: existing.groups,
    });

    return { variant: 'ok', embedCode };
  },
};
