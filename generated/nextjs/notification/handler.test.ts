// Notification — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { notificationHandler } from './handler.js';
import type { NotificationStorage } from './types.js';

const createTestStorage = (): NotificationStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
};

const createFailingStorage = (): NotificationStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Notification handler', () => {
  describe('registerChannel', () => {
    it('should register a new channel', async () => {
      const storage = createTestStorage();

      const result = await notificationHandler.registerChannel(
        { name: 'email', config: '{"smtp": "localhost"}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists for duplicate channel', async () => {
      const storage = createTestStorage();
      await notificationHandler.registerChannel(
        { name: 'push', config: '{}' },
        storage,
      )();

      const result = await notificationHandler.registerChannel(
        { name: 'push', config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });
  });

  describe('defineTemplate', () => {
    it('should define a new template', async () => {
      const storage = createTestStorage();

      const result = await notificationHandler.defineTemplate(
        { notification: 'welcome', template: 'Hello {{name}}!' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists for duplicate template', async () => {
      const storage = createTestStorage();
      await notificationHandler.defineTemplate(
        { notification: 'alert', template: '{{msg}}' },
        storage,
      )();

      const result = await notificationHandler.defineTemplate(
        { notification: 'alert', template: '{{msg}}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });
  });

  describe('subscribe', () => {
    it('should subscribe a user to an event channel', async () => {
      const storage = createTestStorage();

      const result = await notificationHandler.subscribe(
        { user: 'user1', eventType: 'order.created', channel: 'email' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists for duplicate subscription', async () => {
      const storage = createTestStorage();
      await notificationHandler.subscribe(
        { user: 'user1', eventType: 'order.created', channel: 'email' },
        storage,
      )();

      const result = await notificationHandler.subscribe(
        { user: 'user1', eventType: 'order.created', channel: 'email' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe an existing subscription', async () => {
      const storage = createTestStorage();
      await notificationHandler.subscribe(
        { user: 'user1', eventType: 'order.created', channel: 'email' },
        storage,
      )();

      const result = await notificationHandler.unsubscribe(
        { user: 'user1', eventType: 'order.created', channel: 'email' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent subscription', async () => {
      const storage = createTestStorage();

      const result = await notificationHandler.unsubscribe(
        { user: 'nobody', eventType: 'none', channel: 'none' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('notify', () => {
    it('should send a notification and store in inbox', async () => {
      const storage = createTestStorage();
      await notificationHandler.defineTemplate(
        { notification: 'welcome', template: 'Hello {{name}}!' },
        storage,
      )();
      await notificationHandler.subscribe(
        { user: 'user1', eventType: 'welcome', channel: 'email' },
        storage,
      )();

      const result = await notificationHandler.notify(
        { notification: 'welcome', user: 'user1', template: 'welcome', data: '{"name":"Alice"}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return error when template not found', async () => {
      const storage = createTestStorage();

      const result = await notificationHandler.notify(
        { notification: 'missing', user: 'user1', template: 'missing', data: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });
  });

  describe('markRead', () => {
    it('should mark a notification as read', async () => {
      const storage = createTestStorage();
      await storage.put('inbox', 'notif_123', {
        notificationId: 'notif_123',
        user: 'user1',
        read: false,
      });

      const result = await notificationHandler.markRead(
        { notification: 'notif_123' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent notification', async () => {
      const storage = createTestStorage();

      const result = await notificationHandler.markRead(
        { notification: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('getUnread', () => {
    it('should return unread notifications as JSON', async () => {
      const storage = createTestStorage();
      await storage.put('inbox', 'notif_a', {
        notificationId: 'notif_a',
        notificationType: 'alert',
        user: 'user1',
        content: 'Hello',
        read: false,
        deliveredAt: 1000,
      });

      const result = await notificationHandler.getUnread(
        { user: 'user1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const parsed = JSON.parse(result.right.notifications);
        expect(Array.isArray(parsed)).toBe(true);
      }
    });
  });

  describe('storage errors', () => {
    it('should return left on storage failure in registerChannel', async () => {
      const storage = createFailingStorage();

      const result = await notificationHandler.registerChannel(
        { name: 'email', config: '{}' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
