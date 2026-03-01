// Widget Concept Implementation
// Catalog of registered UI component definitions with AST representations and category organization.
import type { ConceptHandler } from '@clef/runtime';

let widgetCounter = 0;

export const widgetHandler: ConceptHandler = {
  async register(input, storage) {
    const widget = input.widget as string;
    const name = input.name as string;
    const ast = input.ast as string;
    const category = input.category as string;

    const existing = await storage.get('widget', widget);
    if (existing) {
      return { variant: 'duplicate', message: 'A widget with this identity already exists' };
    }

    // Validate the AST is parseable JSON
    try {
      JSON.parse(ast);
    } catch {
      return { variant: 'invalid', message: 'Widget AST must be valid JSON' };
    }

    widgetCounter++;

    await storage.put('widget', widget, {
      widget,
      name,
      category: category || 'general',
      ast,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async get(input, storage) {
    const widget = input.widget as string;

    const existing = await storage.get('widget', widget);
    if (!existing) {
      return { variant: 'notfound', message: 'Widget not found' };
    }

    return {
      variant: 'ok',
      ast: existing.ast as string,
      name: existing.name as string,
    };
  },

  async list(input, storage) {
    const category = input.category as string;

    const results = await storage.find('widget', category || '');
    const allWidgets = Array.isArray(results) ? results : [];

    const filtered = category
      ? allWidgets.filter((w) => w.category === category)
      : allWidgets;

    const widgets = filtered.map((w) => ({
      widget: w.widget,
      name: w.name,
      category: w.category,
      version: w.version,
    }));

    return { variant: 'ok', widgets: JSON.stringify(widgets) };
  },

  async unregister(input, storage) {
    const widget = input.widget as string;

    const existing = await storage.get('widget', widget);
    if (!existing) {
      return { variant: 'notfound', message: 'Widget not found' };
    }

    await storage.put('widget', widget, {
      __deleted: true,
    });

    return { variant: 'ok' };
  },
};
