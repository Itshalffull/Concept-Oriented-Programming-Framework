// Template Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const templateHandler: ConceptHandler = {
  async define(input, storage) {
    const template = input.template as string;
    const body = input.body as string;
    const variables = input.variables as string;

    const existing = await storage.get('template', template);
    if (existing) {
      return { variant: 'exists', message: 'A template with this identity already exists' };
    }

    await storage.put('template', template, {
      template,
      body,
      variables,
      triggers: '[]',
    });

    return { variant: 'ok' };
  },

  async instantiate(input, storage) {
    const template = input.template as string;
    const values = input.values as string;

    const existing = await storage.get('template', template);
    if (!existing) {
      return { variant: 'notfound', message: 'Template not found' };
    }

    const body = existing.body as string;
    const pairs = values.split('&').reduce<Record<string, string>>((acc, pair) => {
      const [key, val] = pair.split('=');
      if (key) acc[key] = val ?? '';
      return acc;
    }, {});

    let content = body;
    for (const [key, val] of Object.entries(pairs)) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    }

    return { variant: 'ok', content };
  },

  async registerTrigger(input, storage) {
    const template = input.template as string;
    const trigger = input.trigger as string;

    const existing = await storage.get('template', template);
    if (!existing) {
      return { variant: 'notfound', message: 'Template not found' };
    }

    const triggers = JSON.parse((existing.triggers as string) || '[]') as string[];
    triggers.push(trigger);

    await storage.put('template', template, {
      ...existing,
      triggers: JSON.stringify(triggers),
    });

    return { variant: 'ok' };
  },

  async mergeProperties(input, storage) {
    const template = input.template as string;
    const properties = input.properties as string;

    const existing = await storage.get('template', template);
    if (!existing) {
      return { variant: 'notfound', message: 'Template not found' };
    }

    const currentVariables = existing.variables as string;
    const merged = currentVariables
      ? `${currentVariables},${properties}`
      : properties;

    await storage.put('template', template, {
      ...existing,
      variables: merged,
    });

    return { variant: 'ok' };
  },
};
