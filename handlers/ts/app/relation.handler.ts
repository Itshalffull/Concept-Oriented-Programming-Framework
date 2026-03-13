// Relation Concept Implementation
import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

export const relationHandler: ConceptHandler = {
  async defineRelation(input: Record<string, unknown>, storage: ConceptStorage) {
    const relation = input.relation as string;
    const schema = input.schema as string;

    const existing = await storage.get('relation', relation);
    if (existing) {
      return { variant: 'exists', relation };
    }

    await storage.put('relation', relation, {
      relation,
      definition: schema,
      links: JSON.stringify([]),
      rollups: '',
    });

    return { variant: 'ok', relation };
  },

  async link(input: Record<string, unknown>, storage: ConceptStorage) {
    const relation = input.relation as string;
    const source = input.source as string;
    const target = input.target as string;

    const existing = await storage.get('relation', relation);
    if (!existing) {
      return { variant: 'invalid', relation, message: 'Relation does not exist' };
    }

    const links: { source: string; target: string }[] = JSON.parse(existing.links as string);

    const duplicate = links.some(l => l.source === source && l.target === target);
    if (duplicate) {
      return { variant: 'invalid', relation, message: 'Link already exists between source and target' };
    }

    links.push({ source, target });

    await storage.put('relation', relation, {
      ...existing,
      links: JSON.stringify(links),
    });

    return { variant: 'ok', relation, source, target };
  },

  async unlink(input: Record<string, unknown>, storage: ConceptStorage) {
    const relation = input.relation as string;
    const source = input.source as string;
    const target = input.target as string;

    const existing = await storage.get('relation', relation);
    if (!existing) {
      return { variant: 'notfound', relation, source, target };
    }

    const links: { source: string; target: string }[] = JSON.parse(existing.links as string);

    const index = links.findIndex(l => l.source === source && l.target === target);
    if (index === -1) {
      return { variant: 'notfound', relation, source, target };
    }

    links.splice(index, 1);

    await storage.put('relation', relation, {
      ...existing,
      links: JSON.stringify(links),
    });

    return { variant: 'ok', relation, source, target };
  },

  async getRelated(input: Record<string, unknown>, storage: ConceptStorage) {
    const relation = input.relation as string;
    const entity = input.entity as string;

    const existing = await storage.get('relation', relation);
    if (!existing) {
      return { variant: 'notfound', relation, entity };
    }

    const links: { source: string; target: string }[] = JSON.parse(existing.links as string);

    const related: string[] = [];
    for (const l of links) {
      if (l.source === entity && !related.includes(l.target)) {
        related.push(l.target);
      }
      if (l.target === entity && !related.includes(l.source)) {
        related.push(l.source);
      }
    }

    if (related.length === 0) {
      return { variant: 'notfound', relation, entity };
    }

    // Return single related entity as plain string, multiple as comma-separated
    const relatedValue = related.length === 1 ? related[0] : related.join(',');
    return { variant: 'ok', related: relatedValue };
  },

  async defineRollup(input: Record<string, unknown>, storage: ConceptStorage) {
    const relation = input.relation as string;
    const formula = input.formula as string;

    const existing = await storage.get('relation', relation);
    if (!existing) {
      return { variant: 'notfound', relation };
    }

    await storage.put('relation', relation, {
      ...existing,
      rollups: formula,
    });

    return { variant: 'ok', relation, formula };
  },

  async computeRollup(input: Record<string, unknown>, storage: ConceptStorage) {
    const relation = input.relation as string;
    const entity = input.entity as string;

    const existing = await storage.get('relation', relation);
    if (!existing) {
      return { variant: 'notfound', relation, entity };
    }

    const rollupFormula = existing.rollups as string;
    if (!rollupFormula) {
      return { variant: 'notfound', relation, entity };
    }

    const links: { source: string; target: string }[] = JSON.parse(existing.links as string);

    const related: string[] = [];
    for (const l of links) {
      if (l.source === entity) {
        related.push(l.target);
      }
      if (l.target === entity) {
        related.push(l.source);
      }
    }

    if (related.length === 0) {
      return { variant: 'notfound', relation, entity };
    }

    // Compute rollup based on formula type
    let value: string;
    if (rollupFormula === 'count') {
      value = String(related.length);
    } else {
      value = JSON.stringify(related);
    }

    return { variant: 'ok', value };
  },

  async trackViewItems(input: Record<string, unknown>, storage: ConceptStorage) {
    const viewId = String(input.view ?? '');
    const itemsRaw = input.items as string;
    if (!viewId || !itemsRaw) {
      return { variant: 'error', message: 'view and items are required' };
    }

    let itemIds: string[];
    try {
      itemIds = JSON.parse(itemsRaw);
    } catch {
      return { variant: 'error', message: 'items must be a JSON array of strings' };
    }

    // Ensure view-item relation type exists
    const existing = await storage.get('relation', 'view-item');
    if (!existing) {
      await storage.put('relation', 'view-item', {
        relation: 'view-item',
        definition: JSON.stringify({
          forward_label: 'displays',
          reverse_label: 'appears in',
          cardinality: 'many-to-many',
        }),
        links: JSON.stringify([]),
        rollups: '',
      });
    }

    // Get current links
    const rel = await storage.get('relation', 'view-item');
    const links: { source: string; target: string }[] = JSON.parse(rel!.links as string);

    // Find existing links for this view
    const existingTargets = new Set(
      links.filter(l => l.source === viewId).map(l => l.target),
    );
    const currentItems = new Set(itemIds.filter(Boolean));

    // Add new links
    let created = 0;
    for (const itemId of currentItems) {
      if (!existingTargets.has(itemId)) {
        links.push({ source: viewId, target: itemId });
        created++;
      }
    }

    // Remove stale links
    let removed = 0;
    const updated = links.filter(l => {
      if (l.source === viewId && !currentItems.has(l.target)) {
        removed++;
        return false;
      }
      return true;
    });

    await storage.put('relation', 'view-item', {
      ...rel!,
      links: JSON.stringify(updated),
    });

    return { variant: 'ok', created, removed, total: itemIds.length };
  },

  async list(_input: Record<string, unknown>, storage: ConceptStorage) {
    const all = await storage.find('relation', {});
    return { variant: 'ok', items: JSON.stringify(all) };
  },
};
