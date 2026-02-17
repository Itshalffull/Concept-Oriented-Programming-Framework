// Entity Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const entityHandler: ConceptHandler = {
  async create(input, storage) {
    const entity = input.entity as string;
    const bundle = input.bundle as string;

    await storage.put('entity', entity, { entity, bundle, createdAt: '', updatedAt: '' });

    return { variant: 'ok', entity };
  },

  async delete(input, storage) {
    const entity = input.entity as string;

    const existing = await storage.get('entity', entity);
    if (!existing) {
      return { variant: 'notfound', message: 'Entity not found' };
    }

    await storage.del('entity', entity);

    return { variant: 'ok', entity };
  },

  async get(input, storage) {
    const entity = input.entity as string;

    const record = await storage.get('entity', entity);
    if (!record) {
      return { variant: 'notfound', message: 'Entity not found' };
    }

    return {
      variant: 'ok',
      entity,
      bundle: record.bundle as string,
    };
  },

  async touch(input, storage) {
    const entity = input.entity as string;

    const record = await storage.get('entity', entity);
    if (!record) {
      return { variant: 'notfound', message: 'Entity not found' };
    }

    const now = new Date().toISOString();
    await storage.put('entity', entity, {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
    });

    return { variant: 'ok', entity };
  },
};
