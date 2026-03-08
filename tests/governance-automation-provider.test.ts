// ============================================================
// GovernanceAutomationProvider Handler Tests
//
// Route automation actions through governance gates before
// execution. Ensures actions pass governance checks.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  governanceAutomationProviderHandler,
  resetGovernanceAutomationProvider,
} from '../handlers/ts/governance-automation-provider.handler.js';

describe('GovernanceAutomationProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetGovernanceAutomationProvider();
  });

  describe('register', () => {
    it('registers with provider name "governance"', async () => {
      const result = await governanceAutomationProviderHandler.register!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.provider_name).toBe('governance');
    });

    it('returns already_registered on second call', async () => {
      await governanceAutomationProviderHandler.register!({}, storage);
      const result = await governanceAutomationProviderHandler.register!({}, storage);
      expect(result.variant).toBe('already_registered');
    });

    it('persists registration state in storage', async () => {
      await governanceAutomationProviderHandler.register!({}, storage);
      const record = await storage.get('governance-automation-provider', '__registered');
      expect(record).not.toBeNull();
      expect(record!.value).toBe(true);
    });
  });

  describe('execute — ok variant', () => {
    it('approves action with timelock gate', async () => {
      const result = await governanceAutomationProviderHandler.execute!(
        {
          action_payload: '{"action":"transfer"}',
          gate_config: '{"gate":"timelock","delay":3600}',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.result).toBeDefined();
      const parsed = JSON.parse(result.result as string);
      expect(parsed.gate).toBe('timelock');
      expect(parsed.approved).toBe(true);
    });

    it('approves action with no specific gate type', async () => {
      const result = await governanceAutomationProviderHandler.execute!(
        {
          action_payload: '{"action":"read"}',
          gate_config: '{}',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('approves when quorum is met', async () => {
      const result = await governanceAutomationProviderHandler.execute!(
        {
          action_payload: '{"action":"approve"}',
          gate_config: '{"gate":"quorum","required":3,"current":5}',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('approves when guard condition is not deny', async () => {
      const result = await governanceAutomationProviderHandler.execute!(
        {
          action_payload: '{"action":"update"}',
          gate_config: '{"gate":"guard","condition":"allow"}',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('stores approved execution record', async () => {
      await governanceAutomationProviderHandler.execute!(
        {
          action_payload: '{"action":"transfer"}',
          gate_config: '{"gate":"timelock","delay":0}',
        },
        storage,
      );
      const record = await storage.get('governance-automation-provider', 'gov-auto-1');
      expect(record).not.toBeNull();
      expect(record!.status).toBe('approved');
      expect(record!.block_reason).toBeNull();
    });
  });

  describe('execute — blocked variant', () => {
    it('blocks action when guard condition is deny', async () => {
      const result = await governanceAutomationProviderHandler.execute!(
        {
          action_payload: '{"action":"delete"}',
          gate_config: '{"gate":"guard","condition":"deny"}',
        },
        storage,
      );
      expect(result.variant).toBe('blocked');
      expect(result.reason).toContain('Guard condition denied');
    });

    it('blocks action when quorum is not met', async () => {
      const result = await governanceAutomationProviderHandler.execute!(
        {
          action_payload: '{"action":"transfer"}',
          gate_config: '{"gate":"quorum","required":5,"current":2}',
        },
        storage,
      );
      expect(result.variant).toBe('blocked');
      expect(result.reason).toContain('Quorum not met');
      expect(result.reason).toContain('2/5');
    });

    it('blocks when action_payload is missing', async () => {
      const result = await governanceAutomationProviderHandler.execute!(
        { gate_config: '{"gate":"timelock"}' },
        storage,
      );
      expect(result.variant).toBe('blocked');
      expect(result.reason).toBe('action_payload is required');
    });

    it('blocks when gate_config is missing', async () => {
      const result = await governanceAutomationProviderHandler.execute!(
        { action_payload: '{"action":"test"}' },
        storage,
      );
      expect(result.variant).toBe('blocked');
      expect(result.reason).toBe('gate_config is required');
    });

    it('blocks for invalid gate_config JSON', async () => {
      const result = await governanceAutomationProviderHandler.execute!(
        { action_payload: '{"action":"test"}', gate_config: 'not-json' },
        storage,
      );
      expect(result.variant).toBe('blocked');
      expect(result.reason).toBe('Invalid gate_config JSON');
    });

    it('blocks for invalid action_payload JSON', async () => {
      const result = await governanceAutomationProviderHandler.execute!(
        { action_payload: 'not-json', gate_config: '{"gate":"guard"}' },
        storage,
      );
      expect(result.variant).toBe('blocked');
      expect(result.reason).toBe('Invalid action_payload JSON');
    });

    it('stores blocked execution record', async () => {
      await governanceAutomationProviderHandler.execute!(
        {
          action_payload: '{"action":"delete"}',
          gate_config: '{"gate":"guard","condition":"deny"}',
        },
        storage,
      );
      const record = await storage.get('governance-automation-provider', 'gov-auto-1');
      expect(record).not.toBeNull();
      expect(record!.status).toBe('blocked');
      expect(record!.block_reason).toContain('Guard condition denied');
    });
  });
});
