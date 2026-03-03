// ============================================================
// Agentic Delegate Concept Conformance Tests
//
// Tests for agent registration, role assumption, action proposals,
// escalation, and autonomy management.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { agenticDelegateHandler } from '../../handlers/ts/app/governance/agentic-delegate.handler.js';

describe('Agentic Delegate Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('register', () => {
    it('registers a delegate agent', async () => {
      const result = await agenticDelegateHandler.register({
        name: 'bot-1', principal: 'alice', autonomyLevel: 'supervised',
        allowedActions: ['vote', 'propose'],
      }, storage);
      expect(result.variant).toBe('registered');
      expect(result.delegate).toBeDefined();
    });
  });

  describe('assumeRole / releaseRole', () => {
    it('assumes and releases a role', async () => {
      const reg = await agenticDelegateHandler.register({
        name: 'bot-2', principal: 'alice', autonomyLevel: 'supervised',
        allowedActions: ['vote'],
      }, storage);
      const assume = await agenticDelegateHandler.assumeRole(
        { delegate: reg.delegate, role: 'voter' },
        storage,
      );
      expect(assume.variant).toBe('role_assumed');

      const release = await agenticDelegateHandler.releaseRole(
        { delegate: reg.delegate },
        storage,
      );
      expect(release.variant).toBe('role_released');
    });
  });

  describe('proposeAction', () => {
    it('proposes an allowed action', async () => {
      const reg = await agenticDelegateHandler.register({
        name: 'bot-3', principal: 'alice', autonomyLevel: 'supervised',
        allowedActions: ['vote', 'propose'],
      }, storage);
      const result = await agenticDelegateHandler.proposeAction({
        delegate: reg.delegate, action: 'vote', rationale: 'Supporting budget',
      }, storage);
      expect(result.variant).toBe('proposed');
    });

    it('denies a disallowed action', async () => {
      const reg = await agenticDelegateHandler.register({
        name: 'bot-4', principal: 'alice', autonomyLevel: 'supervised',
        allowedActions: ['vote'],
      }, storage);
      const result = await agenticDelegateHandler.proposeAction({
        delegate: reg.delegate, action: 'treasury-withdraw', rationale: 'Need funds',
      }, storage);
      expect(result.variant).toBe('action_denied');
    });
  });

  describe('escalate', () => {
    it('escalates an action to principal', async () => {
      const reg = await agenticDelegateHandler.register({
        name: 'bot-5', principal: 'alice', autonomyLevel: 'supervised',
        allowedActions: [],
      }, storage);
      const result = await agenticDelegateHandler.escalate({
        delegate: reg.delegate, action: 'critical-decision', reason: 'Out of scope',
      }, storage);
      expect(result.variant).toBe('escalated');
    });
  });

  describe('updateAutonomy', () => {
    it('updates autonomy level', async () => {
      const reg = await agenticDelegateHandler.register({
        name: 'bot-6', principal: 'alice', autonomyLevel: 'supervised',
        allowedActions: ['vote'],
      }, storage);
      const result = await agenticDelegateHandler.updateAutonomy({
        delegate: reg.delegate, autonomyLevel: 'autonomous',
      }, storage);
      expect(result.variant).toBe('updated');
    });
  });
});
