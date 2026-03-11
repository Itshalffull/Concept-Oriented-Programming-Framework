import { randomUUID } from 'crypto';
import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

export const attributionHandler: ConceptHandler = {
  async attribute(input: Record<string, unknown>, storage: ConceptStorage) {
    const { module_id, contributor, role } = input;
    // Check for existing attribution for same module + contributor
    const existing = await storage.find('attributions', {
      module_id: module_id as string,
      contributor: contributor as string,
    });
    if (existing.length > 0) return { variant: 'exists' };

    const id = randomUUID();
    await storage.put('attributions', id, {
      id,
      module_id: module_id as string,
      contributor: contributor as string,
      role: role as string,
      addedAt: new Date().toISOString(),
    });
    return { variant: 'ok', attribution: id };
  },

  async remove(input: Record<string, unknown>, storage: ConceptStorage) {
    const { attribution } = input;
    const record = await storage.get('attributions', attribution as string);
    if (!record) return { variant: 'notfound' };
    await storage.del('attributions', attribution as string);
    return { variant: 'ok' };
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    const { module_id } = input;
    const all = await storage.find('attributions', { module_id: module_id as string });
    const attributions = all.map((a) => ({
      contributor: a.contributor,
      role: a.role,
      addedAt: a.addedAt,
    }));
    return { variant: 'ok', attributions };
  },
};
