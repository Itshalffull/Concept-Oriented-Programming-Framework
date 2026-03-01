// WebhookInbox — handler.ts
// Real fp-ts domain logic for webhook correlation with event-type matching and TTL-based expiry.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WebhookInboxStorage,
  WebhookInboxStatus,
  WebhookInboxRegisterInput,
  WebhookInboxRegisterOutput,
  WebhookInboxReceiveInput,
  WebhookInboxReceiveOutput,
  WebhookInboxExpireInput,
  WebhookInboxExpireOutput,
  WebhookInboxAckInput,
  WebhookInboxAckOutput,
} from './types.js';

import {
  registerOk,
  receiveOk,
  receiveNoMatch,
  receiveInvalidStatus,
  expireOk,
  expireNotFound,
  expireInvalidStatus,
  ackOk,
  ackNotFound,
  ackInvalidStatus,
} from './types.js';

export interface WebhookInboxError {
  readonly code: string;
  readonly message: string;
}

export interface WebhookInboxHandler {
  readonly register: (
    input: WebhookInboxRegisterInput,
    storage: WebhookInboxStorage,
  ) => TE.TaskEither<WebhookInboxError, WebhookInboxRegisterOutput>;
  readonly receive: (
    input: WebhookInboxReceiveInput,
    storage: WebhookInboxStorage,
  ) => TE.TaskEither<WebhookInboxError, WebhookInboxReceiveOutput>;
  readonly expire: (
    input: WebhookInboxExpireInput,
    storage: WebhookInboxStorage,
  ) => TE.TaskEither<WebhookInboxError, WebhookInboxExpireOutput>;
  readonly ack: (
    input: WebhookInboxAckInput,
    storage: WebhookInboxStorage,
  ) => TE.TaskEither<WebhookInboxError, WebhookInboxAckOutput>;
}

// --- Pure helpers ---

const compositeKey = (run_ref: string, step_ref: string): string =>
  `${run_ref}::${step_ref}`;

const correlationIndex = (correlation_key: string, event_type: string): string =>
  `${correlation_key}::${event_type}`;

const storageError = (error: unknown): WebhookInboxError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// --- Implementation ---

export const webhookInboxHandler: WebhookInboxHandler = {
  /**
   * Register a webhook inbox that waits for an incoming event matching a
   * correlation key and event type. Stores a correlation index for efficient
   * matching on receive.
   */
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const key = compositeKey(input.run_ref, input.step_ref);
          const corrIdx = correlationIndex(input.correlation_key, input.event_type);
          const now = Date.now();
          const ttl = input.ttl_ms ?? DEFAULT_TTL_MS;

          await storage.put('webhook_inboxes', key, {
            inbox_id: key,
            run_ref: input.run_ref,
            step_ref: input.step_ref,
            correlation_key: input.correlation_key,
            event_type: input.event_type,
            correlation_index: corrIdx,
            status: 'waiting' as WebhookInboxStatus,
            ttl_ms: ttl,
            expires_at: now + ttl,
            payload: null,
            headers: null,
            created_at: now,
            updated_at: now,
          });

          // Store a reverse index by correlation key + event type for fast lookup
          await storage.put('webhook_correlation', corrIdx, {
            inbox_id: key,
            correlation_key: input.correlation_key,
            event_type: input.event_type,
          });

          return registerOk(key, 'waiting', input.correlation_key);
        },
        storageError,
      ),
    ),

  /**
   * Receive a webhook event. Matches by correlation_key + event_type.
   * Only delivers to inboxes in waiting status.
   */
  receive: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('webhook_correlation', correlationIndex(input.correlation_key, input.event_type)),
        storageError,
      ),
      TE.chain((corrRecord) =>
        pipe(
          O.fromNullable(corrRecord),
          O.fold(
            () => TE.right<WebhookInboxError, WebhookInboxReceiveOutput>(
              receiveNoMatch(
                `No inbox registered for correlation_key='${input.correlation_key}' event_type='${input.event_type}'`,
              ),
            ),
            (corr) => {
              const inboxId = corr.inbox_id as string;
              return pipe(
                TE.tryCatch(
                  () => storage.get('webhook_inboxes', inboxId),
                  storageError,
                ),
                TE.chain((inboxRecord) =>
                  pipe(
                    O.fromNullable(inboxRecord),
                    O.fold(
                      () => TE.right<WebhookInboxError, WebhookInboxReceiveOutput>(
                        receiveNoMatch(`Inbox '${inboxId}' no longer exists`),
                      ),
                      (inbox) => {
                        const status = inbox.status as WebhookInboxStatus;
                        if (status !== 'waiting') {
                          return TE.right<WebhookInboxError, WebhookInboxReceiveOutput>(
                            receiveInvalidStatus(
                              `Inbox must be in 'waiting' status to receive, currently '${status}'`,
                              status,
                            ),
                          );
                        }
                        return TE.tryCatch(
                          async () => {
                            await storage.put('webhook_inboxes', inboxId, {
                              ...inbox,
                              status: 'received' as WebhookInboxStatus,
                              payload: input.payload,
                              headers: input.headers ?? null,
                              received_at: Date.now(),
                              updated_at: Date.now(),
                            });
                            return receiveOk(inboxId, 'received', input.payload);
                          },
                          storageError,
                        );
                      },
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Expire a waiting inbox. Transitions from waiting to expired.
   */
  expire: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('webhook_inboxes', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<WebhookInboxError, WebhookInboxExpireOutput>(
              expireNotFound(`Inbox '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (inbox) => {
              const status = inbox.status as WebhookInboxStatus;
              if (status !== 'waiting') {
                return TE.right<WebhookInboxError, WebhookInboxExpireOutput>(
                  expireInvalidStatus(
                    `Inbox must be in 'waiting' status to expire, currently '${status}'`,
                    status,
                  ),
                );
              }
              const key = compositeKey(input.run_ref, input.step_ref);
              return TE.tryCatch(
                async () => {
                  await storage.put('webhook_inboxes', key, {
                    ...inbox,
                    status: 'expired' as WebhookInboxStatus,
                    expired_at: Date.now(),
                    updated_at: Date.now(),
                  });
                  return expireOk(key, 'expired');
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Acknowledge a received webhook. Transitions from received to acknowledged.
   */
  ack: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('webhook_inboxes', compositeKey(input.run_ref, input.step_ref)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<WebhookInboxError, WebhookInboxAckOutput>(
              ackNotFound(`Inbox '${compositeKey(input.run_ref, input.step_ref)}' not found`),
            ),
            (inbox) => {
              const status = inbox.status as WebhookInboxStatus;
              if (status !== 'received') {
                return TE.right<WebhookInboxError, WebhookInboxAckOutput>(
                  ackInvalidStatus(
                    `Inbox must be in 'received' status to acknowledge, currently '${status}'`,
                    status,
                  ),
                );
              }
              const key = compositeKey(input.run_ref, input.step_ref);
              return TE.tryCatch(
                async () => {
                  await storage.put('webhook_inboxes', key, {
                    ...inbox,
                    status: 'acknowledged' as WebhookInboxStatus,
                    acknowledged_at: Date.now(),
                    updated_at: Date.now(),
                  });
                  return ackOk(key, 'acknowledged');
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),
};
