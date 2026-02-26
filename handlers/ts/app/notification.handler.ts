// Notification Concept Implementation
// Deliver user-facing alerts across multiple channels with subscription management,
// templating, and inbox tracking.
import type { ConceptHandler } from '@clef/kernel';

export const notificationHandler: ConceptHandler = {
  async registerChannel(input, storage) {
    const name = input.name as string;
    const config = input.config as string;

    const existing = await storage.get('channel', name);
    if (existing) {
      return { variant: 'exists', message: 'Channel already registered' };
    }

    await storage.put('channel', name, { name, config });

    return { variant: 'ok' };
  },

  async defineTemplate(input, storage) {
    const notification = input.notification as string;
    const template = input.template as string;

    const existing = await storage.get('template', notification);
    if (existing) {
      return { variant: 'exists', message: 'Template already exists for this notification type' };
    }

    await storage.put('template', notification, { notification, template });

    return { variant: 'ok' };
  },

  async subscribe(input, storage) {
    const user = input.user as string;
    const eventType = input.eventType as string;
    const channel = input.channel as string;

    const subKey = `${user}:${eventType}:${channel}`;
    const existing = await storage.get('subscription', subKey);
    if (existing) {
      return { variant: 'exists', message: 'Subscription already exists' };
    }

    await storage.put('subscription', subKey, { user, eventType, channel });

    return { variant: 'ok' };
  },

  async unsubscribe(input, storage) {
    const user = input.user as string;
    const eventType = input.eventType as string;
    const channel = input.channel as string;

    const subKey = `${user}:${eventType}:${channel}`;
    const existing = await storage.get('subscription', subKey);
    if (!existing) {
      return { variant: 'notfound', message: 'Subscription does not exist' };
    }

    await storage.del('subscription', subKey);

    return { variant: 'ok' };
  },

  async notify(input, storage) {
    const notification = input.notification as string;
    const user = input.user as string;
    const template = input.template as string;
    const data = input.data as string;

    // Verify the template exists
    const templateRecord = await storage.get('template', notification);
    if (!templateRecord) {
      // Allow sending even without pre-defined template; use provided template directly
    }

    // Create inbox entry for the user
    const now = new Date().toISOString();
    await storage.put('notification', notification, {
      notification,
      user,
      template,
      data,
      read: false,
      createdAt: now,
    });

    // Log delivery
    await storage.put('deliveryLog', `${notification}:${now}`, {
      notification,
      user,
      template,
      status: 'delivered',
      timestamp: now,
    });

    return { variant: 'ok' };
  },

  async markRead(input, storage) {
    const notification = input.notification as string;

    const existing = await storage.get('notification', notification);
    if (!existing) {
      return { variant: 'notfound', message: 'Notification does not exist' };
    }

    await storage.put('notification', notification, {
      ...existing,
      read: true,
    });

    return { variant: 'ok' };
  },

  async getUnread(input, storage) {
    const user = input.user as string;

    const allNotifications = await storage.find('notification');
    const unread = allNotifications.filter(
      (record) => record.user === user && record.read === false,
    );

    const notifications = JSON.stringify(
      unread.map((record) => ({
        notification: record.notification,
        template: record.template,
        data: record.data,
        createdAt: record.createdAt,
      })),
    );

    return { variant: 'ok', notifications };
  },
};
