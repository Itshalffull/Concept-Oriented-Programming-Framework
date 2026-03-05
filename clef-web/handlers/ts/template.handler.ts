import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

export const templateHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const { name, layout, slots } = input as {
      name: string; layout: string; slots?: string[];
    };

    const existing = await storage.get('template', name);
    if (existing) return { variant: 'exists', name };

    await storage.put('template', name, {
      name,
      layout,
      slots: slots ?? [],
    });

    return { variant: 'ok', template: name };
  },

  async render(input: Record<string, unknown>, storage: ConceptStorage) {
    const { name, data } = input as { name: string; data: string };

    const template = await storage.get('template', name);
    if (!template) return { variant: 'notfound', name };

    try {
      const parsed = JSON.parse(data);
      let html = template.layout as string;
      const slots = template.slots as string[];
      for (const slot of slots) {
        html = html.replace(new RegExp(`\\{\\{${slot}\\}\\}`, 'g'), parsed[slot] ?? '');
      }
      return { variant: 'ok', html };
    } catch (err) {
      return { variant: 'error', message: String(err) };
    }
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    const all = await storage.find('template', {});
    const templates = all.map((t) => ({
      name: t.name,
      slots: t.slots,
    }));

    return { variant: 'ok', templates };
  },
};
