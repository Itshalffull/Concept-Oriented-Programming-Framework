// Relation Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const relationHandler: ConceptHandler = {
  async defineRelation(input, storage) {
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

  async link(input, storage) {
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

  async unlink(input, storage) {
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

  async getRelated(input, storage) {
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

    return { variant: 'ok', related: JSON.stringify(related) };
  },

  async defineRollup(input, storage) {
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

  async computeRollup(input, storage) {
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
};
