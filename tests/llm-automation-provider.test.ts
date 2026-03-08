// ============================================================
// LLMAutomationProvider Handler Tests
//
// Execute automation actions via LLM calls. Dispatches action
// payloads to configured LLM providers.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  llmAutomationProviderHandler,
  resetLLMAutomationProvider,
} from '../handlers/ts/llm-automation-provider.handler.js';

describe('LLMAutomationProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetLLMAutomationProvider();
  });

  describe('register', () => {
    it('registers with provider name "llm"', async () => {
      const result = await llmAutomationProviderHandler.register!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.provider_name).toBe('llm');
    });

    it('returns already_registered on second call', async () => {
      await llmAutomationProviderHandler.register!({}, storage);
      const result = await llmAutomationProviderHandler.register!({}, storage);
      expect(result.variant).toBe('already_registered');
    });

    it('persists registration state in storage', async () => {
      await llmAutomationProviderHandler.register!({}, storage);
      const record = await storage.get('llm-automation-provider', '__registered');
      expect(record).not.toBeNull();
      expect(record!.value).toBe(true);
    });
  });

  describe('execute', () => {
    it('executes an LLM action and returns a result', async () => {
      const result = await llmAutomationProviderHandler.execute!(
        {
          action_payload: '{"action":"summarize","text":"hello world"}',
          model_config: '{"model":"gpt-4"}',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.result).toBeDefined();
      const parsed = JSON.parse(result.result as string);
      expect(parsed.model).toBe('gpt-4');
      expect(parsed.action).toBe('summarize');
    });

    it('stores execution record in storage', async () => {
      await llmAutomationProviderHandler.execute!(
        {
          action_payload: '{"action":"classify"}',
          model_config: '{"model":"claude-3"}',
        },
        storage,
      );
      const record = await storage.get('llm-automation-provider', 'llm-auto-1');
      expect(record).not.toBeNull();
      expect(record!.status).toBe('completed');
      expect(record!.action_payload).toBe('{"action":"classify"}');
    });

    it('returns error when action_payload is missing', async () => {
      const result = await llmAutomationProviderHandler.execute!(
        { model_config: '{"model":"gpt-4"}' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toBe('action_payload is required');
    });

    it('returns error when model_config is missing', async () => {
      const result = await llmAutomationProviderHandler.execute!(
        { action_payload: '{"action":"test"}' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toBe('model_config is required');
    });

    it('returns error for invalid model_config JSON', async () => {
      const result = await llmAutomationProviderHandler.execute!(
        { action_payload: '{"action":"test"}', model_config: 'not-json' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toBe('Invalid model_config JSON');
    });

    it('returns error for invalid action_payload JSON', async () => {
      const result = await llmAutomationProviderHandler.execute!(
        { action_payload: 'not-json', model_config: '{"model":"gpt-4"}' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toBe('Invalid action_payload JSON');
    });

    it('returns error when model_config lacks model field', async () => {
      const result = await llmAutomationProviderHandler.execute!(
        { action_payload: '{"action":"test"}', model_config: '{"temperature":0.5}' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toBe('model_config must include a model field');
    });

    it('generates unique IDs for multiple executions', async () => {
      await llmAutomationProviderHandler.execute!(
        { action_payload: '{"a":1}', model_config: '{"model":"m1"}' },
        storage,
      );
      await llmAutomationProviderHandler.execute!(
        { action_payload: '{"a":2}', model_config: '{"model":"m2"}' },
        storage,
      );
      const r1 = await storage.get('llm-automation-provider', 'llm-auto-1');
      const r2 = await storage.get('llm-automation-provider', 'llm-auto-2');
      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
      expect(r1!.id).not.toBe(r2!.id);
    });
  });
});
