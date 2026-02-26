// ============================================================
// Widget Concept Implementation
//
// Headless state machine catalog. Registers UI widget definitions
// with their machine specs, anatomy, and accessibility contracts.
// Relation: 'widget' keyed by component (P).
// ============================================================

import type { ConceptHandler } from '../../../runtime/types.js';

export const widgetHandler: ConceptHandler = {
  async register(input, storage) {
    const component = input.component as string;
    const name = input.name as string;
    const machineSpec = input.machineSpec as string;
    const anatomy = input.anatomy as string;
    const a11ySpec = input.a11ySpec as string;

    // Check name uniqueness across all registered widgets
    const existing = await storage.find('widget', { name });
    if (existing.length > 0) {
      return { variant: 'duplicate', message: `Widget with name "${name}" already exists` };
    }

    await storage.put('widget', component, {
      component,
      name,
      anatomy,
      defaultConfig: '{}',
      machineSpec,
      a11ySpec,
      category: '',
    });

    return { variant: 'ok', component };
  },

  async configure(input, storage) {
    const component = input.component as string;
    const config = input.config as string;

    const existing = await storage.get('widget', component);
    if (!existing) {
      return { variant: 'notfound', message: `Widget "${component}" not found` };
    }

    await storage.put('widget', component, {
      ...existing,
      defaultConfig: config,
    });

    return { variant: 'ok', component };
  },

  async get(input, storage) {
    const component = input.component as string;

    const record = await storage.get('widget', component);
    if (!record) {
      return { variant: 'notfound', message: `Widget "${component}" not found` };
    }

    return {
      variant: 'ok',
      component,
      machineSpec: record.machineSpec as string,
      anatomy: record.anatomy as string,
      a11ySpec: record.a11ySpec as string,
    };
  },

  async list(input, storage) {
    const category = input.category as string | null;

    let results: Record<string, unknown>[];
    if (category) {
      results = await storage.find('widget', { category });
    } else {
      results = await storage.find('widget');
    }

    const components = results.map((r) => r.component as string);

    return { variant: 'ok', components: JSON.stringify(components) };
  },

  async unregister(input, storage) {
    const component = input.component as string;

    const existing = await storage.get('widget', component);
    if (!existing) {
      return { variant: 'notfound', message: `Widget "${component}" not found` };
    }

    await storage.del('widget', component);

    return { variant: 'ok', component };
  },
};
