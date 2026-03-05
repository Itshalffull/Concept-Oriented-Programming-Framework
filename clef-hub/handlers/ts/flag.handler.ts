import { randomUUID } from 'crypto';
import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

export const flagHandler: ConceptHandler = {
  async flag(input: Record<string, unknown>, storage: ConceptStorage) {
    const { entity, flagType, reporter, reason } = input;
    // Check for duplicate open flag from same reporter on same entity
    const existing = await storage.find('flags', {
      entity: entity as string,
      reporter: reporter as string,
      status: 'open',
    });
    if (existing.length > 0) return { variant: 'duplicate' };

    const id = randomUUID();
    await storage.put('flags', id, {
      id,
      entity: entity as string,
      flagType: flagType as string,
      reporter: reporter as string,
      reason: reason as string,
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    return { variant: 'ok', flag: id };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const { flag } = input;
    const record = await storage.get('flags', flag as string);
    if (!record) return { variant: 'notfound' };
    await storage.put('flags', flag as string, { ...record, status: 'resolved' });
    return { variant: 'ok' };
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    const { entity } = input;
    const all = await storage.find('flags', { entity: entity as string });
    const flags = all.map((f) => ({
      id: f.id,
      flagType: f.flagType,
      reporter: f.reporter,
      reason: f.reason,
      status: f.status,
    }));
    return { variant: 'ok', flags };
  },
};
