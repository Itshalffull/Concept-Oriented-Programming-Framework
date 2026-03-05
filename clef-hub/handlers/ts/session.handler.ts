import { randomUUID } from 'crypto';
import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export const sessionHandler: ConceptHandler = {
  async create(input: Record<string, unknown>, storage: ConceptStorage) {
    const { userId, token } = input;
    const session = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await storage.put('sessions', session, {
      userId: userId as string,
      token: token as string,
      expiresAt,
      active: true,
    });
    return { variant: 'ok', session };
  },

  async validate(input: Record<string, unknown>, storage: ConceptStorage) {
    const { session } = input;
    const record = await storage.get('sessions', session as string);
    if (!record || !record.active) return { variant: 'invalid' };
    if (new Date(record.expiresAt as string) < new Date()) {
      await storage.put('sessions', session as string, { ...record, active: false });
      return { variant: 'expired' };
    }
    return { variant: 'ok', userId: record.userId };
  },

  async destroy(input: Record<string, unknown>, storage: ConceptStorage) {
    const { session } = input;
    const record = await storage.get('sessions', session as string);
    if (!record) return { variant: 'notfound' };
    await storage.put('sessions', session as string, { ...record, active: false });
    return { variant: 'ok' };
  },

  async getContext(input: Record<string, unknown>, storage: ConceptStorage) {
    const { session } = input;
    const record = await storage.get('sessions', session as string);
    if (!record || !record.active) return { variant: 'invalid' };
    return { variant: 'ok', userId: record.userId, token: record.token };
  },
};
