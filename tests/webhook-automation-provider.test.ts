// ============================================================
// WebhookAutomationProvider Handler Tests
//
// Fire outgoing webhooks as automation actions. Sends HTTP
// requests to configured webhook endpoints.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  webhookAutomationProviderHandler,
  resetWebhookAutomationProvider,
} from '../handlers/ts/webhook-automation-provider.handler.js';

describe('WebhookAutomationProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetWebhookAutomationProvider();
  });

  describe('register', () => {
    it('registers with provider name "webhook"', async () => {
      const result = await webhookAutomationProviderHandler.register!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.provider_name).toBe('webhook');
    });

    it('returns already_registered on second call', async () => {
      await webhookAutomationProviderHandler.register!({}, storage);
      const result = await webhookAutomationProviderHandler.register!({}, storage);
      expect(result.variant).toBe('already_registered');
    });

    it('persists registration state in storage', async () => {
      await webhookAutomationProviderHandler.register!({}, storage);
      const record = await storage.get('webhook-automation-provider', '__registered');
      expect(record).not.toBeNull();
      expect(record!.value).toBe(true);
    });
  });

  describe('execute', () => {
    it('sends a webhook and returns a response', async () => {
      const result = await webhookAutomationProviderHandler.execute!(
        {
          action_payload: '{"event":"deploy"}',
          webhook_url: 'https://hooks.example.com/deploy',
          method: 'POST',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.response).toBeDefined();
      const parsed = JSON.parse(result.response as string);
      expect(parsed.status).toBe(200);
      expect(parsed.url).toBe('https://hooks.example.com/deploy');
      expect(parsed.method).toBe('POST');
      expect(parsed.delivered).toBe(true);
    });

    it('stores execution record in storage', async () => {
      await webhookAutomationProviderHandler.execute!(
        {
          action_payload: '{"event":"test"}',
          webhook_url: 'https://hooks.example.com/test',
          method: 'POST',
        },
        storage,
      );
      const record = await storage.get('webhook-automation-provider', 'webhook-auto-1');
      expect(record).not.toBeNull();
      expect(record!.status).toBe('completed');
      expect(record!.webhook_url).toBe('https://hooks.example.com/test');
    });

    it('defaults method to POST when not specified', async () => {
      const result = await webhookAutomationProviderHandler.execute!(
        {
          action_payload: '{"event":"test"}',
          webhook_url: 'https://hooks.example.com/test',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      const parsed = JSON.parse(result.response as string);
      expect(parsed.method).toBe('POST');
    });

    it('accepts GET, PUT, PATCH, DELETE methods', async () => {
      for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
        resetWebhookAutomationProvider();
        const result = await webhookAutomationProviderHandler.execute!(
          {
            action_payload: '{"event":"test"}',
            webhook_url: 'https://hooks.example.com/test',
            method,
          },
          storage,
        );
        expect(result.variant).toBe('ok');
        const parsed = JSON.parse(result.response as string);
        expect(parsed.method).toBe(method);
      }
    });

    it('returns error when action_payload is missing', async () => {
      const result = await webhookAutomationProviderHandler.execute!(
        { webhook_url: 'https://hooks.example.com', method: 'POST' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toBe('action_payload is required');
    });

    it('returns error when webhook_url is missing', async () => {
      const result = await webhookAutomationProviderHandler.execute!(
        { action_payload: '{"event":"test"}', method: 'POST' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toBe('webhook_url is required');
    });

    it('returns error for invalid URL', async () => {
      const result = await webhookAutomationProviderHandler.execute!(
        {
          action_payload: '{"event":"test"}',
          webhook_url: 'not-a-url',
          method: 'POST',
        },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('Invalid webhook URL');
    });

    it('returns error for invalid HTTP method', async () => {
      const result = await webhookAutomationProviderHandler.execute!(
        {
          action_payload: '{"event":"test"}',
          webhook_url: 'https://hooks.example.com/test',
          method: 'INVALID',
        },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('Invalid HTTP method');
    });

    it('generates unique IDs for multiple executions', async () => {
      await webhookAutomationProviderHandler.execute!(
        { action_payload: '{"a":1}', webhook_url: 'https://a.com', method: 'POST' },
        storage,
      );
      await webhookAutomationProviderHandler.execute!(
        { action_payload: '{"a":2}', webhook_url: 'https://b.com', method: 'POST' },
        storage,
      );
      const r1 = await storage.get('webhook-automation-provider', 'webhook-auto-1');
      const r2 = await storage.get('webhook-automation-provider', 'webhook-auto-2');
      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
      expect(r1!.id).not.toBe(r2!.id);
    });
  });
});
