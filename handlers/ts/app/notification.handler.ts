// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Notification Concept Implementation
// Deliver user-facing alerts across multiple channels with subscription management,
// templating, and inbox tracking.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _notificationHandler: FunctionalConceptHandler = {
  registerChannel(input: Record<string, unknown>) {
    const name = input.name as string;
    const config = input.config as string;

    let p = createProgram();
    p = spGet(p, 'channel', name, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'Channel already registered' }),
      (b) => {
        let b2 = put(b, 'channel', name, { name, config });
        return complete(b2, 'ok', {});
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  defineTemplate(input: Record<string, unknown>) {
    const notification = input.notification as string;
    const template = input.template as string;

    let p = createProgram();
    p = spGet(p, 'template', notification, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'Template already exists for this notification type' }),
      (b) => {
        let b2 = put(b, 'template', notification, { notification, template });
        return complete(b2, 'ok', {});
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  subscribe(input: Record<string, unknown>) {
    const user = input.user as string;
    const eventType = input.eventType as string;
    const channel = input.channel as string;

    const subKey = `${user}:${eventType}:${channel}`;

    let p = createProgram();
    p = spGet(p, 'subscription', subKey, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'Subscription already exists' }),
      (b) => {
        let b2 = put(b, 'subscription', subKey, { user, eventType, channel });
        return complete(b2, 'ok', {});
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  unsubscribe(input: Record<string, unknown>) {
    const user = input.user as string;
    const eventType = input.eventType as string;
    const channel = input.channel as string;

    const subKey = `${user}:${eventType}:${channel}`;

    let p = createProgram();
    p = spGet(p, 'subscription', subKey, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'subscription', subKey);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Subscription does not exist' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  notify(input: Record<string, unknown>) {
    const notification = input.notification as string;
    const user = input.user as string;
    const template = input.template as string;
    const data = input.data as string;

    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'notification', notification, {
      notification,
      user,
      template,
      data,
      read: false,
      createdAt: now,
    });

    p = put(p, 'deliveryLog', `${notification}:${now}`, {
      notification,
      user,
      template,
      status: 'delivered',
      timestamp: now,
    });

    return complete(p, 'ok', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  markRead(input: Record<string, unknown>) {
    const notification = input.notification as string;

    let p = createProgram();
    p = spGet(p, 'notification', notification, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'notification', notification, { read: true });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Notification does not exist' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getUnread(input: Record<string, unknown>) {
    const user = input.user as string;

    let p = createProgram();
    p = find(p, 'notification', {}, 'allNotifications');
    return complete(p, 'ok', { notifications: JSON.stringify([]) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const notificationHandler = autoInterpret(_notificationHandler);

