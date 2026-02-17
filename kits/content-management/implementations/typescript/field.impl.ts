// Field Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const fieldHandler: ConceptHandler = {
  async attach(input, storage) {
    const field = input.field as string;
    const target = input.target as string;
    const name = input.name as string;
    const value = input.value as string;

    await storage.put('field', field, { field, target, name, value });

    return { variant: 'ok', field };
  },

  async detach(input, storage) {
    const field = input.field as string;

    const existing = await storage.get('field', field);
    if (!existing) {
      return { variant: 'notfound', message: 'Field not found' };
    }

    await storage.del('field', field);

    return { variant: 'ok', field };
  },

  async get(input, storage) {
    const field = input.field as string;

    const record = await storage.get('field', field);
    if (!record) {
      return { variant: 'notfound', message: 'Field not found' };
    }

    return {
      variant: 'ok',
      field,
      target: record.target as string,
      name: record.name as string,
      value: record.value as string,
    };
  },
};
