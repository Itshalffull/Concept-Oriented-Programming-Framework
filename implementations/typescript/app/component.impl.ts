// Component Concept Implementation
// Discoverable, configurable UI units with conditional placement rules for composing page layouts.
import type { ConceptHandler } from '@copf/kernel';

export const componentHandler: ConceptHandler = {
  async register(input, storage) {
    const component = input.component as string;
    const config = input.config as string;

    const existing = await storage.get('component', component);
    if (existing) {
      return { variant: 'exists', message: 'A component with this identity already exists' };
    }

    await storage.put('component', component, {
      component,
      config,
      placements: JSON.stringify([]),
      conditions: '',
      visible: true,
    });

    return { variant: 'ok' };
  },

  async render(input, storage) {
    const component = input.component as string;
    const context = input.context as string;

    const existing = await storage.get('component', component);
    if (!existing) {
      return { variant: 'notfound', message: 'The component was not found' };
    }

    const config = existing.config as string;
    const placements: string[] = JSON.parse(
      (existing.placements as string) || '[]',
    );
    const visible = existing.visible as boolean;

    if (!visible) {
      return { variant: 'ok', output: '' };
    }

    // Compose output from config, placement, and context
    const region = placements.length > 0 ? placements[0] : 'default';
    const output = `${config}:${region}:${context}`;

    return { variant: 'ok', output };
  },

  async place(input, storage) {
    const component = input.component as string;
    const region = input.region as string;

    const existing = await storage.get('component', component);
    if (!existing) {
      return { variant: 'notfound', message: 'The component was not found' };
    }

    const placements: string[] = JSON.parse(
      (existing.placements as string) || '[]',
    );

    if (!placements.includes(region)) {
      placements.push(region);
    }

    await storage.put('component', component, {
      ...existing,
      placements: JSON.stringify(placements),
    });

    return { variant: 'ok' };
  },

  async setVisibility(input, storage) {
    const component = input.component as string;
    const visible = input.visible as boolean;

    const existing = await storage.get('component', component);
    if (!existing) {
      return { variant: 'notfound', message: 'The component was not found' };
    }

    await storage.put('component', component, {
      ...existing,
      visible,
    });

    return { variant: 'ok' };
  },

  async evaluateVisibility(input, storage) {
    const component = input.component as string;
    const context = input.context as string;

    const existing = await storage.get('component', component);
    if (!existing) {
      return { variant: 'notfound', message: 'The component was not found' };
    }

    const visible = existing.visible as boolean;
    const conditions = existing.conditions as string;

    // Evaluate visibility: if no conditions are set, use the stored visible flag;
    // otherwise, evaluate conditions against the context
    let effectiveVisibility = visible;
    if (conditions) {
      // Simple condition evaluation: if the context contains the condition string, visible
      effectiveVisibility = context.includes(conditions);
    }

    return { variant: 'ok', visible: effectiveVisibility };
  },
};
