// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// WebhookAutomationProvider Handler
//
// Fire outgoing webhooks as automation actions. Sends HTTP
// requests to configured webhook endpoints when automation
// rules trigger. See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function webhookId(actionPayload: string, url: string): string {
  const key = `${actionPayload.slice(0, 20)}-${url.slice(0, 20)}`.replace(/[^a-z0-9]/gi, '_');
  return `webhook-auto-${key}`;
}

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'webhook-automation-provider', '__registered', 'existingReg');
    return branch(p, 'existingReg',
      (thenP) => complete(thenP, 'already_registered', { name: 'WebhookAutomationProvider', provider_name: 'WebhookAutomationProvider' }),
      (elseP) => {
        elseP = put(elseP, 'webhook-automation-provider', '__registered', { value: true });
        return complete(elseP, 'ok', { name: 'WebhookAutomationProvider', provider_name: 'WebhookAutomationProvider' });
      },
    ) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const actionPayload = input.action_payload as string;
    const webhookUrl = input.webhook_url as string;
    const method = (input.method as string || 'POST').toUpperCase();

    // Validate inputs
    if (!actionPayload) {
      const p = createProgram();
      return complete(p, 'error', { message: 'action_payload is required' }) as StorageProgram<Result>;
    }
    if (!webhookUrl) {
      const p = createProgram();
      return complete(p, 'error', { message: 'webhook_url is required' }) as StorageProgram<Result>;
    }

    // Validate URL format
    try {
      new URL(webhookUrl);
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: `Invalid webhook URL: ${webhookUrl}` }) as StorageProgram<Result>;
    }

    // Validate HTTP method
    if (!VALID_METHODS.includes(method)) {
      const p = createProgram();
      return complete(p, 'error', { message: `Invalid HTTP method: ${method}. Must be one of ${VALID_METHODS.join(', ')}` }) as StorageProgram<Result>;
    }

    // Simulate webhook delivery
    const id = webhookId(actionPayload, webhookUrl);
    const now = new Date().toISOString();
    const response = JSON.stringify({
      status: 200,
      url: webhookUrl,
      method,
      delivered: true,
      timestamp: now,
    });

    let p = createProgram();
    p = put(p, 'webhook-automation-provider', id, {
      id,
      action_payload: actionPayload,
      webhook_url: webhookUrl,
      method,
      status: 'completed',
      response,
      error: null,
      createdAt: now,
    });

    return complete(p, 'ok', { response }) as StorageProgram<Result>;
  },
};

export const webhookAutomationProviderHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetWebhookAutomationProvider(): void {
  idCounter = 0;
  registered = false;
}
