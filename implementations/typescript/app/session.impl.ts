// Session Concept Implementation
// Manage authenticated session lifecycle: creation, validation, refresh, and device tracking.
// Each session binds a user identity to a specific device with a bounded-lifetime token.
import { randomBytes } from 'crypto';
import type { ConceptHandler } from '@copf/kernel';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const sessionHandler: ConceptHandler = {
  async create(input, storage) {
    const session = input.session as string;
    const userId = input.userId as string;
    const device = input.device as string;

    // Generate an opaque session token and set expiration
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    await storage.put('session', session, {
      session,
      userId,
      device,
      token,
      expiresAt,
      isValid: true,
    });

    // Maintain a reverse index of user -> sessions for destroyAll
    const userSessions = await storage.get('userSessions', userId);
    const sessionIds: string[] = userSessions
      ? JSON.parse(userSessions.sessionIds as string)
      : [];
    sessionIds.push(session);
    await storage.put('userSessions', userId, {
      userId,
      sessionIds: JSON.stringify(sessionIds),
    });

    return { variant: 'ok', token };
  },

  async validate(input, storage) {
    const session = input.session as string;

    const record = await storage.get('session', session);
    if (!record) {
      return { variant: 'notfound', message: 'No session exists with this identifier' };
    }

    const expiresAt = new Date(record.expiresAt as string);
    const valid = record.isValid === true && expiresAt.getTime() > Date.now();

    return { variant: 'ok', valid };
  },

  async refresh(input, storage) {
    const session = input.session as string;

    const record = await storage.get('session', session);
    if (!record) {
      return { variant: 'notfound', message: 'No session exists with this identifier' };
    }

    const expiresAt = new Date(record.expiresAt as string);
    if (!record.isValid || expiresAt.getTime() <= Date.now()) {
      return { variant: 'expired', message: 'The session has already expired and cannot be refreshed' };
    }

    // Issue a new token and extend lifetime
    const newToken = randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    await storage.put('session', session, {
      ...record,
      token: newToken,
      expiresAt: newExpiresAt,
    });

    return { variant: 'ok', token: newToken };
  },

  async destroy(input, storage) {
    const session = input.session as string;

    const record = await storage.get('session', session);
    if (!record) {
      return { variant: 'notfound', message: 'No session exists with this identifier' };
    }

    // Remove the session from the user's session index
    const userId = record.userId as string;
    const userSessions = await storage.get('userSessions', userId);
    if (userSessions) {
      const sessionIds: string[] = JSON.parse(userSessions.sessionIds as string);
      const filtered = sessionIds.filter(id => id !== session);
      await storage.put('userSessions', userId, {
        userId,
        sessionIds: JSON.stringify(filtered),
      });
    }

    await storage.delete('session', session);

    return { variant: 'ok', session };
  },

  async destroyAll(input, storage) {
    const userId = input.userId as string;

    const userSessions = await storage.get('userSessions', userId);
    if (userSessions) {
      const sessionIds: string[] = JSON.parse(userSessions.sessionIds as string);
      for (const id of sessionIds) {
        await storage.delete('session', id);
      }
    }

    // Clear the user's session index
    await storage.put('userSessions', userId, {
      userId,
      sessionIds: JSON.stringify([]),
    });

    return { variant: 'ok', userId };
  },

  async getContext(input, storage) {
    const session = input.session as string;

    const record = await storage.get('session', session);
    if (!record) {
      return { variant: 'notfound', message: 'No session exists with this identifier' };
    }

    return {
      variant: 'ok',
      userId: record.userId as string,
      device: record.device as string,
    };
  },
};
