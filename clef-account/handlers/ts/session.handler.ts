import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const sessionHandler: ConceptHandler = {
  async create(input: Record<string, unknown>, storage: ConceptStorage) {
    const session = input.session as string;
    const userId = input.userId as string;
    const device = input.device as string;

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await storage.put('session', session, { userId, device, expiresAt, active: true });

    return { variant: 'ok', session, expiresAt };
  },

  async validate(input: Record<string, unknown>, storage: ConceptStorage) {
    const session = input.session as string;

    const record = await storage.get('session', session);
    if (!record || !record.active) {
      return { variant: 'invalid' };
    }

    if (new Date(record.expiresAt as string) < new Date()) {
      await storage.put('session', session, { ...record, active: false });
      return { variant: 'expired' };
    }

    return { variant: 'ok', userId: record.userId };
  },

  async refresh(input: Record<string, unknown>, storage: ConceptStorage) {
    const session = input.session as string;

    const record = await storage.get('session', session);
    if (!record || !record.active) {
      return { variant: 'expired' };
    }

    if (new Date(record.expiresAt as string) < new Date()) {
      await storage.put('session', session, { ...record, active: false });
      return { variant: 'expired' };
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await storage.put('session', session, { ...record, expiresAt });

    return { variant: 'ok', expiresAt };
  },

  async destroy(input: Record<string, unknown>, storage: ConceptStorage) {
    const session = input.session as string;

    const record = await storage.get('session', session);
    if (!record) {
      return { variant: 'notfound' };
    }

    await storage.put('session', session, { ...record, active: false });
    return { variant: 'ok' };
  },

  async destroyAll(input: Record<string, unknown>, storage: ConceptStorage) {
    const userId = input.userId as string;

    const sessions = await storage.find('session', { userId });
    let count = 0;
    for (const s of sessions) {
      if (s.active) {
        await storage.put('session', s.session as string, { ...s, active: false });
        count++;
      }
    }

    return { variant: 'ok', count };
  },

  async getContext(input: Record<string, unknown>, storage: ConceptStorage) {
    const session = input.session as string;

    const record = await storage.get('session', session);
    if (!record || !record.active) {
      return { variant: 'invalid' };
    }

    return {
      variant: 'ok',
      userId: record.userId,
      device: record.device,
      expiresAt: record.expiresAt,
    };
  },
};
