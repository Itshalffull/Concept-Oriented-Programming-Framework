// Notification — handler.ts
// Real fp-ts domain logic for multi-channel notification delivery with inbox tracking.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import { randomBytes } from 'crypto';

import type {
  NotificationStorage,
  NotificationRegisterChannelInput,
  NotificationRegisterChannelOutput,
  NotificationDefineTemplateInput,
  NotificationDefineTemplateOutput,
  NotificationSubscribeInput,
  NotificationSubscribeOutput,
  NotificationUnsubscribeInput,
  NotificationUnsubscribeOutput,
  NotificationNotifyInput,
  NotificationNotifyOutput,
  NotificationMarkReadInput,
  NotificationMarkReadOutput,
  NotificationGetUnreadInput,
  NotificationGetUnreadOutput,
} from './types.js';

import {
  registerChannelOk,
  registerChannelExists,
  defineTemplateOk,
  defineTemplateExists,
  subscribeOk,
  subscribeExists,
  unsubscribeOk,
  unsubscribeNotfound,
  notifyOk,
  notifyError,
  markReadOk,
  markReadNotfound,
  getUnreadOk,
} from './types.js';

export interface NotificationError {
  readonly code: string;
  readonly message: string;
}

export interface NotificationHandler {
  readonly registerChannel: (
    input: NotificationRegisterChannelInput,
    storage: NotificationStorage,
  ) => TE.TaskEither<NotificationError, NotificationRegisterChannelOutput>;
  readonly defineTemplate: (
    input: NotificationDefineTemplateInput,
    storage: NotificationStorage,
  ) => TE.TaskEither<NotificationError, NotificationDefineTemplateOutput>;
  readonly subscribe: (
    input: NotificationSubscribeInput,
    storage: NotificationStorage,
  ) => TE.TaskEither<NotificationError, NotificationSubscribeOutput>;
  readonly unsubscribe: (
    input: NotificationUnsubscribeInput,
    storage: NotificationStorage,
  ) => TE.TaskEither<NotificationError, NotificationUnsubscribeOutput>;
  readonly notify: (
    input: NotificationNotifyInput,
    storage: NotificationStorage,
  ) => TE.TaskEither<NotificationError, NotificationNotifyOutput>;
  readonly markRead: (
    input: NotificationMarkReadInput,
    storage: NotificationStorage,
  ) => TE.TaskEither<NotificationError, NotificationMarkReadOutput>;
  readonly getUnread: (
    input: NotificationGetUnreadInput,
    storage: NotificationStorage,
  ) => TE.TaskEither<NotificationError, NotificationGetUnreadOutput>;
}

// --- Pure helpers ---

const generateId = (): string => randomBytes(12).toString('hex');

const storageError = (error: unknown): NotificationError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Composite key for a user's subscription to event+channel. */
const subscriptionKey = (user: string, eventType: string, channel: string): string =>
  `${user}::${eventType}::${channel}`;

/**
 * Render a template string by replacing {{placeholder}} tokens with
 * values from the data object.
 */
const renderTemplate = (template: string, data: Record<string, unknown>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = data[key];
    return value !== undefined ? String(value) : `{{${key}}}`;
  });

/** Safely parse a JSON string, returning an empty object on failure. */
const safeParseJson = (raw: string): Record<string, unknown> => {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
};

// --- Implementation ---

export const notificationHandler: NotificationHandler = {
  /**
   * Register a delivery channel (email, push, in-app, SMS, etc.) with its
   * transport configuration. Returns exists if the channel is already registered.
   */
  registerChannel: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('channels', input.name),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('channels', input.name, {
                    name: input.name,
                    config: input.config,
                    registeredAt: Date.now(),
                  });
                  return registerChannelOk();
                },
                storageError,
              ),
            () => TE.right<NotificationError, NotificationRegisterChannelOutput>(
              registerChannelExists(`Channel '${input.name}' is already registered`),
            ),
          ),
        ),
      ),
    ),

  /**
   * Define a notification template with placeholders for dynamic data.
   * Returns exists if a template is already defined for this notification type.
   */
  defineTemplate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('templates', input.notification),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('templates', input.notification, {
                    notification: input.notification,
                    template: input.template,
                    createdAt: Date.now(),
                  });
                  return defineTemplateOk();
                },
                storageError,
              ),
            () => TE.right<NotificationError, NotificationDefineTemplateOutput>(
              defineTemplateExists(`Template already exists for notification '${input.notification}'`),
            ),
          ),
        ),
      ),
    ),

  /**
   * Subscribe a user to receive notifications for an event type on a
   * specific channel. Idempotent: returns exists if already subscribed.
   */
  subscribe: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get(
          'subscriptions',
          subscriptionKey(input.user, input.eventType, input.channel),
        ),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put(
                    'subscriptions',
                    subscriptionKey(input.user, input.eventType, input.channel),
                    {
                      user: input.user,
                      eventType: input.eventType,
                      channel: input.channel,
                      subscribedAt: Date.now(),
                    },
                  );
                  return subscribeOk();
                },
                storageError,
              ),
            () => TE.right<NotificationError, NotificationSubscribeOutput>(
              subscribeExists(
                `User '${input.user}' is already subscribed to '${input.eventType}' on '${input.channel}'`,
              ),
            ),
          ),
        ),
      ),
    ),

  /**
   * Unsubscribe a user from an event type on a channel. Returns notfound
   * if no matching subscription exists.
   */
  unsubscribe: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get(
          'subscriptions',
          subscriptionKey(input.user, input.eventType, input.channel),
        ),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () => TE.right<NotificationError, NotificationUnsubscribeOutput>(
              unsubscribeNotfound(
                `No subscription found for user '${input.user}' on '${input.eventType}' via '${input.channel}'`,
              ),
            ),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete(
                    'subscriptions',
                    subscriptionKey(input.user, input.eventType, input.channel),
                  );
                  return unsubscribeOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  /**
   * Send a notification to a user. Renders the template with provided data,
   * looks up the user's subscribed channels, and delivers across all of them.
   * Stores the notification in the user's inbox as unread.
   */
  notify: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('templates', input.notification),
        storageError,
      ),
      TE.chain((templateRecord) =>
        pipe(
          O.fromNullable(templateRecord),
          O.fold(
            () => TE.right<NotificationError, NotificationNotifyOutput>(
              notifyError(`Template '${input.template}' not found`),
            ),
            (tmpl) => {
              const templateStr = tmpl.template as string;
              const data = safeParseJson(input.data);
              const rendered = renderTemplate(templateStr, data);
              const notificationId = `notif_${generateId()}`;

              return TE.tryCatch(
                async () => {
                  // Find user's subscriptions to determine delivery channels
                  const subs = await storage.find('subscriptions', { user: input.user });
                  const channels = subs.map((s) => s.channel as string);

                  // Record delivery log per channel
                  for (const channel of channels) {
                    const deliveryId = `del_${generateId()}`;
                    await storage.put('deliveryLog', deliveryId, {
                      deliveryId,
                      notificationId,
                      user: input.user,
                      channel,
                      content: rendered,
                      status: 'delivered',
                      deliveredAt: Date.now(),
                    });
                  }

                  // Store in user's inbox as unread
                  await storage.put('inbox', notificationId, {
                    notificationId,
                    notificationType: input.notification,
                    user: input.user,
                    content: rendered,
                    read: false,
                    channels: JSON.stringify(channels),
                    deliveredAt: Date.now(),
                  });

                  return notifyOk();
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Mark a notification as read, removing it from the user's unread count.
   */
  markRead: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('inbox', input.notification),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<NotificationError, NotificationMarkReadOutput>(
              markReadNotfound(`Notification '${input.notification}' not found`),
            ),
            (notif) =>
              TE.tryCatch(
                async () => {
                  await storage.put('inbox', input.notification, {
                    ...notif,
                    read: true,
                    readAt: Date.now(),
                  });
                  return markReadOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  /**
   * Retrieve all unread notifications for a user, ordered by delivery time
   * (most recent first).
   */
  getUnread: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('inbox', { user: input.user, read: false }),
        storageError,
      ),
      TE.map((records) => {
        const sorted = [...records].sort((a, b) => {
          const ta = typeof a.deliveredAt === 'number' ? a.deliveredAt : 0;
          const tb = typeof b.deliveredAt === 'number' ? b.deliveredAt : 0;
          return tb - ta;
        });
        const notifications = sorted.map((r) => ({
          notificationId: r.notificationId,
          notificationType: r.notificationType,
          content: r.content,
          deliveredAt: r.deliveredAt,
        }));
        return getUnreadOk(JSON.stringify(notifications));
      }),
    ),
};
