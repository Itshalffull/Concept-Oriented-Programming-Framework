// View Concept Implementation
// Config entities: dataSource (concept/action to query), layout (display type),
// filters/sorts/groups, visibleFields, formatting, controls (action triggers).
import type { ConceptHandler } from '@clef/runtime';

const VALID_LAYOUTS = ['table', 'card-grid', 'tree', 'board', 'calendar', 'timeline', 'graph', 'list'];

export const viewHandler: ConceptHandler = {
  async list(_input, storage) {
    const items = await storage.find('view', {});
    return { variant: 'ok', items: JSON.stringify(items) };
  },

  async get(input, storage) {
    const view = input.view as string;
    const record = await storage.get('view', view);
    if (!record) {
      return { variant: 'notfound', message: 'View not found' };
    }
    return {
      variant: 'ok',
      view,
      dataSource: record.dataSource as string,
      layout: record.layout as string,
      filters: record.filters as string,
      sorts: record.sorts as string,
      groups: record.groups as string,
      visibleFields: record.visibleFields as string,
      formatting: record.formatting as string,
      controls: record.controls as string,
      title: record.title as string,
      description: record.description as string,
    };
  },

  async resolve(input, storage) {
    const view = input.view as string;
    const record = await storage.get('view', view);
    if (!record) {
      return { variant: 'notfound', message: 'View not found' };
    }

    // Return the view config for the frontend to execute the query.
    // The frontend's ViewRenderer calls invoke(concept, action) using the
    // parsed dataSource. We return the full config so the renderer has
    // everything it needs: dataSource, layout, fields, controls.
    const config = JSON.stringify({
      view,
      dataSource: record.dataSource,
      layout: record.layout,
      filters: record.filters,
      sorts: record.sorts,
      groups: record.groups,
      visibleFields: record.visibleFields,
      formatting: record.formatting,
      controls: record.controls,
      title: record.title,
      description: record.description,
    });

    return { variant: 'ok', data: '[]', config };
  },

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
      filters: input.filters as string ?? '[]',
      sorts: input.sorts as string ?? '[]',
      groups: input.groups as string ?? '[]',
      visibleFields: input.visibleFields as string ?? '[]',
      formatting: input.formatting as string ?? '{}',
      controls: input.controls as string ?? '{}',
      title: input.title as string ?? '',
      description: input.description as string ?? '',
    });

    return { variant: 'ok', view };
  },

  async setControls(input, storage) {
    const view = input.view as string;
    const controls = input.controls as string;

    const existing = await storage.get('view', view);
    if (!existing) {
      return { variant: 'notfound', message: 'View not found' };
    }

    await storage.put('view', view, { ...existing, controls });
    return { variant: 'ok', view };
  },

  async setFilter(input, storage) {
    const view = input.view as string;
    const filter = input.filter as string;

    let existing = await storage.get('view', view);
    if (!existing) {
      existing = {
        view, dataSource: '', layout: '', filters: '[]', sorts: '[]',
        groups: '[]', visibleFields: '[]', formatting: '{}', controls: '{}',
        title: '', description: '',
      };
    }

    await storage.put('view', view, { ...existing, filters: filter });
    return { variant: 'ok', view };
  },

  async setSort(input, storage) {
    const view = input.view as string;
    const sort = input.sort as string;
    const existing = await storage.get('view', view);
    if (!existing) return { variant: 'notfound', message: 'View not found' };
    await storage.put('view', view, { ...existing, sorts: sort });
    return { variant: 'ok', view };
  },

  async setGroup(input, storage) {
    const view = input.view as string;
    const group = input.group as string;
    const existing = await storage.get('view', view);
    if (!existing) return { variant: 'notfound', message: 'View not found' };
    await storage.put('view', view, { ...existing, groups: group });
    return { variant: 'ok', view };
  },

  async setVisibleFields(input, storage) {
    const view = input.view as string;
    const fields = input.fields as string;
    const existing = await storage.get('view', view);
    if (!existing) return { variant: 'notfound', message: 'View not found' };
    await storage.put('view', view, { ...existing, visibleFields: fields });
    return { variant: 'ok', view };
  },

  async changeLayout(input, storage) {
    const view = input.view as string;
    const layout = input.layout as string;

    let existing = await storage.get('view', view);
    if (!existing) {
      existing = {
        view, dataSource: '', layout: '', filters: '[]', sorts: '[]',
        groups: '[]', visibleFields: '[]', formatting: '{}', controls: '{}',
        title: '', description: '',
      };
    }

    await storage.put('view', view, { ...existing, layout });
    return { variant: 'ok', view };
  },

  async duplicate(input, storage) {
    const view = input.view as string;
    const existing = await storage.get('view', view);
    if (!existing) return { variant: 'notfound', message: 'View not found' };

    const newView = `${view}-copy-${Date.now()}`;
    await storage.put('view', newView, { ...existing, view: newView });
    return { variant: 'ok', newView };
  },

  async update(input, storage) {
    const view = input.view as string;
    const existing = await storage.get('view', view);
    if (!existing) return { variant: 'notfound', message: 'View not found' };

    const updated: Record<string, unknown> = { ...existing };
    if (input.dataSource !== undefined) updated.dataSource = input.dataSource as string;
    if (input.layout !== undefined) updated.layout = input.layout as string;
    if (input.filters !== undefined) updated.filters = input.filters as string;
    if (input.sorts !== undefined) updated.sorts = input.sorts as string;
    if (input.groups !== undefined) updated.groups = input.groups as string;
    if (input.visibleFields !== undefined) updated.visibleFields = input.visibleFields as string;
    if (input.formatting !== undefined) updated.formatting = input.formatting as string;
    if (input.controls !== undefined) updated.controls = input.controls as string;
    if (input.title !== undefined) updated.title = input.title as string;
    if (input.description !== undefined) updated.description = input.description as string;

    await storage.put('view', view, updated);
    return { variant: 'ok', view };
  },

  async embed(input, storage) {
    const view = input.view as string;
    const existing = await storage.get('view', view);
    if (!existing) return { variant: 'notfound', message: 'View not found' };

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
