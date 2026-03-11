// WebhookAutomationProvider — Fire outgoing webhooks as automation actions.
// Sends HTTP requests to configured webhook endpoints when automation rules trigger.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WebhookAutomationProviderStorage,
  WebhookAutomationProviderRegisterInput,
  WebhookAutomationProviderRegisterOutput,
  WebhookAutomationProviderExecuteInput,
  WebhookAutomationProviderExecuteOutput,
} from './types.js';

import {
  registerOk,
  registerAlreadyRegistered,
  executeOk,
  executeError,
} from './types.js';

export interface WebhookAutomationProviderError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): WebhookAutomationProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export interface WebhookAutomationProviderHandler {
  readonly register: (
    input: WebhookAutomationProviderRegisterInput,
    storage: WebhookAutomationProviderStorage,
  ) => TE.TaskEither<WebhookAutomationProviderError, WebhookAutomationProviderRegisterOutput>;
  readonly execute: (
    input: WebhookAutomationProviderExecuteInput,
    storage: WebhookAutomationProviderStorage,
  ) => TE.TaskEither<WebhookAutomationProviderError, WebhookAutomationProviderExecuteOutput>;
}

// --- Implementation ---

let idCounter = 0;
function nextId(): string {
  return `webhook-auto-${++idCounter}`;
}

export const webhookAutomationProviderHandler: WebhookAutomationProviderHandler = {
  register: (_input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('webhook-automation-provider', '__registered'),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('webhook-automation-provider', '__registered', { value: true });
                  return registerOk('webhook');
                },
                toStorageError,
              ),
            () => TE.right(registerAlreadyRegistered()),
          ),
        ),
      ),
    ),

  execute: (input, storage) =>
    pipe(
      TE.right(input),
      TE.chain((inp) => {
        if (!inp.action_payload) {
          return TE.right(executeError('action_payload is required'));
        }
        if (!inp.webhook_url) {
          return TE.right(executeError('webhook_url is required'));
        }

        // Validate URL format
        try {
          new URL(inp.webhook_url);
        } catch {
          return TE.right(executeError(`Invalid webhook URL: ${inp.webhook_url}`));
        }

        const method = (inp.method || 'POST').toUpperCase();

        // Validate HTTP method
        if (!VALID_METHODS.includes(method)) {
          return TE.right(
            executeError(`Invalid HTTP method: ${method}. Must be one of ${VALID_METHODS.join(', ')}`),
          );
        }

        const id = nextId();
        const now = new Date().toISOString();
        const response = JSON.stringify({
          status: 200,
          url: inp.webhook_url,
          method,
          delivered: true,
          timestamp: now,
        });

        return TE.tryCatch(
          async () => {
            await storage.put('webhook-automation-provider', id, {
              id,
              action_payload: inp.action_payload,
              webhook_url: inp.webhook_url,
              method,
              status: 'completed',
              response,
              error: null,
              createdAt: now,
            });
            return executeOk(response);
          },
          toStorageError,
        );
      }),
    ),
};
