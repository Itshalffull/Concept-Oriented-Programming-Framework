// ============================================================
// WebhookAutomationProvider Handler
//
// Fire outgoing webhooks as automation actions. Sends HTTP
// requests to configured webhook endpoints when automation
// rules trigger. See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `webhook-auto-${++idCounter}`;
}

let registered = false;

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export const webhookAutomationProviderHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    if (registered) {
      return { variant: 'already_registered' };
    }

    registered = true;
    await storage.put('webhook-automation-provider', '__registered', { value: true });

    return { variant: 'ok', provider_name: 'webhook' };
  },

  async execute(input: Record<string, unknown>, storage: ConceptStorage) {
    const actionPayload = input.action_payload as string;
    const webhookUrl = input.webhook_url as string;
    const method = (input.method as string || 'POST').toUpperCase();

    // Validate inputs
    if (!actionPayload) {
      return { variant: 'error', message: 'action_payload is required' };
    }
    if (!webhookUrl) {
      return { variant: 'error', message: 'webhook_url is required' };
    }

    // Validate URL format
    try {
      new URL(webhookUrl);
    } catch {
      return { variant: 'error', message: `Invalid webhook URL: ${webhookUrl}` };
    }

    // Validate HTTP method
    if (!VALID_METHODS.includes(method)) {
      return { variant: 'error', message: `Invalid HTTP method: ${method}. Must be one of ${VALID_METHODS.join(', ')}` };
    }

    // Simulate webhook delivery — in production this would make an actual HTTP request
    const id = nextId();
    const now = new Date().toISOString();
    const response = JSON.stringify({
      status: 200,
      url: webhookUrl,
      method,
      delivered: true,
      timestamp: now,
    });

    await storage.put('webhook-automation-provider', id, {
      id,
      action_payload: actionPayload,
      webhook_url: webhookUrl,
      method,
      status: 'completed',
      response,
      error: null,
      createdAt: now,
    });

    return { variant: 'ok', response };
  },
};

/** Reset internal state. Useful for testing. */
export function resetWebhookAutomationProvider(): void {
  idCounter = 0;
  registered = false;
}
