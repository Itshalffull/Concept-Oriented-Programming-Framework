// ============================================================
// ProcessAutomationProvider Handler Tests
//
// Trigger ProcessSpec execution from automation rules. Starts
// process runs when automation fires.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  processAutomationProviderHandler,
  resetProcessAutomationProvider,
} from '../handlers/ts/process-automation-provider.handler.js';

describe('ProcessAutomationProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetProcessAutomationProvider();
  });

  describe('register', () => {
    it('registers with provider name "process"', async () => {
      const result = await processAutomationProviderHandler.register!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.provider_name).toBe('process');
    });

    it('returns already_registered on second call', async () => {
      await processAutomationProviderHandler.register!({}, storage);
      const result = await processAutomationProviderHandler.register!({}, storage);
      expect(result.variant).toBe('already_registered');
    });

    it('persists registration state in storage', async () => {
      await processAutomationProviderHandler.register!({}, storage);
      const record = await storage.get('process-automation-provider', '__registered');
      expect(record).not.toBeNull();
      expect(record!.value).toBe(true);
    });
  });

  describe('execute', () => {
    it('starts a process run and returns run_id', async () => {
      const result = await processAutomationProviderHandler.execute!(
        {
          action_payload: '{"input":"data"}',
          process_spec_id: 'spec-001',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.run_id).toBe('run-1');
    });

    it('stores execution record in storage', async () => {
      await processAutomationProviderHandler.execute!(
        {
          action_payload: '{"input":"test"}',
          process_spec_id: 'spec-002',
        },
        storage,
      );
      const record = await storage.get('process-automation-provider', 'proc-auto-1');
      expect(record).not.toBeNull();
      expect(record!.status).toBe('started');
      expect(record!.process_spec_id).toBe('spec-002');
      expect(record!.run_id).toBe('run-1');
    });

    it('generates unique run IDs for multiple executions', async () => {
      const r1 = await processAutomationProviderHandler.execute!(
        { action_payload: '{"a":1}', process_spec_id: 'spec-001' },
        storage,
      );
      const r2 = await processAutomationProviderHandler.execute!(
        { action_payload: '{"a":2}', process_spec_id: 'spec-002' },
        storage,
      );
      expect(r1.run_id).toBe('run-1');
      expect(r2.run_id).toBe('run-2');
    });

    it('returns error when action_payload is missing', async () => {
      const result = await processAutomationProviderHandler.execute!(
        { process_spec_id: 'spec-001' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toBe('action_payload is required');
    });

    it('returns error when process_spec_id is missing', async () => {
      const result = await processAutomationProviderHandler.execute!(
        { action_payload: '{"input":"data"}' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toBe('process_spec_id is required');
    });

    it('returns error for invalid action_payload JSON', async () => {
      const result = await processAutomationProviderHandler.execute!(
        { action_payload: 'not-json', process_spec_id: 'spec-001' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toBe('Invalid action_payload JSON');
    });

    it('succeeds even when process spec is not in storage', async () => {
      // Provider should still create a run — spec may be loaded externally
      const result = await processAutomationProviderHandler.execute!(
        { action_payload: '{"input":"data"}', process_spec_id: 'nonexistent-spec' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.run_id).toBeDefined();
    });
  });
});
