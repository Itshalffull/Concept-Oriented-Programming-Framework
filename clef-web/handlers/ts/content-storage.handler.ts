import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

export const contentStorageHandler: ConceptHandler = {
  async save(input: Record<string, unknown>, storage: ConceptStorage) {
    const { key, data } = input as { key: string; data: string };

    await storage.put('content_blob', key, { key, data });
    return { variant: 'ok', record: key };
  },

  async load(input: Record<string, unknown>, storage: ConceptStorage) {
    const { key } = input as { key: string };

    const record = await storage.get('content_blob', key);
    if (!record) return { variant: 'notfound', key };

    return { variant: 'ok', record: key, data: record.data };
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    const { prefix } = input as { prefix: string };

    const all = await storage.find('content_blob', {});
    const keys = all
      .map((r) => r.key as string)
      .filter((k) => k.startsWith(prefix));

    return { variant: 'ok', keys };
  },

  async remove(input: Record<string, unknown>, storage: ConceptStorage) {
    const { key } = input as { key: string };

    const record = await storage.get('content_blob', key);
    if (!record) return { variant: 'notfound', key };

    await storage.del('content_blob', key);
    return { variant: 'ok' };
  },
};
