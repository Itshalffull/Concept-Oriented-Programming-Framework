import type { ConceptHandler } from '@clef/runtime';

export const contentStorageHandler: ConceptHandler = {
  async save(input, storage) {
    const record = input.record as string;
    const data = input.data as string;
    try {
      await storage.put('record', record, { record, data });
      return { variant: 'ok', record };
    } catch {
      return { variant: 'error', message: 'Backend write failed' };
    }
  },

  async load(input, storage) {
    const record = input.record as string;
    const existing = await storage.get('record', record);
    if (!existing) return { variant: 'notfound', message: 'not found' };
    return { variant: 'ok', record, data: existing.data as string };
  },

  async delete(input, storage) {
    const record = input.record as string;
    const existing = await storage.get('record', record);
    if (!existing) return { variant: 'notfound', message: 'not found' };
    await storage.del('record', record);
    return { variant: 'ok', record };
  },

  async query(input, storage) {
    const filter = input.filter as string;
    const results = await storage.find('record', filter);
    return { variant: 'ok', results: JSON.stringify(results) };
  },

  async generateSchema(input, storage) {
    const record = input.record as string;
    const existing = await storage.get('record', record);
    if (!existing) return { variant: 'notfound', message: 'not found' };
    const data = JSON.parse(existing.data as string);
    const schema: Record<string, string> = {};
    for (const key of Object.keys(data)) {
      schema[key] = typeof data[key];
    }
    return { variant: 'ok', schema: JSON.stringify(schema) };
  },
};
