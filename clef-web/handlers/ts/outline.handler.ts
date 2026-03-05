import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

export const outlineHandler: ConceptHandler = {
  async add(input: Record<string, unknown>, storage: ConceptStorage) {
    const { slug, title, parent, order } = input as {
      slug: string; title: string; parent?: string; order: number;
    };

    const existing = await storage.get('outline_entry', slug);
    if (existing) return { variant: 'exists', slug };

    await storage.put('outline_entry', slug, {
      slug,
      title,
      parent: parent ?? null,
      order,
      visible: true,
    });

    return { variant: 'ok', entry: slug };
  },

  async remove(input: Record<string, unknown>, storage: ConceptStorage) {
    const { slug } = input as { slug: string };

    const entry = await storage.get('outline_entry', slug);
    if (!entry) return { variant: 'notfound', slug };

    // Remove children first
    const children = await storage.find('outline_entry', { parent: slug });
    for (const child of children) {
      await storage.del('outline_entry', child.slug as string);
    }

    await storage.del('outline_entry', slug);
    return { variant: 'ok' };
  },

  async reorder(input: Record<string, unknown>, storage: ConceptStorage) {
    const { slug, order } = input as { slug: string; order: number };

    const entry = await storage.get('outline_entry', slug);
    if (!entry) return { variant: 'notfound', slug };

    await storage.put('outline_entry', slug, { ...entry, order });
    return { variant: 'ok' };
  },

  async getTree(input: Record<string, unknown>, storage: ConceptStorage) {
    const { root } = input as { root?: string };

    const parentKey = root ?? null;
    const topLevel = await storage.find('outline_entry', { parent: parentKey });

    const sorted = topLevel.sort(
      (a, b) => (a.order as number) - (b.order as number),
    );

    const entries = [];
    for (const e of sorted) {
      const children = await storage.find('outline_entry', { parent: e.slug });
      const childSlugs = children
        .sort((a, b) => (a.order as number) - (b.order as number))
        .map((c) => c.slug as string);

      entries.push({
        slug: e.slug,
        title: e.title,
        children: childSlugs,
        order: e.order,
      });
    }

    return { variant: 'ok', entries };
  },
};
