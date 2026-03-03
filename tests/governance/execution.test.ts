// ============================================================
// Execution Concept Conformance Tests
//
// Tests for atomic governance execution: schedule, execute,
// and rollback of governance actions.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { executionHandler } from '../../handlers/ts/app/governance/execution.handler.js';

describe('Execution Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('schedule', () => {
    it('creates a pending execution', async () => {
      const result = await executionHandler.schedule(
        { sourceRef: 'timelock-1', actions: 'transfer(100)', executor: 'governance_executor' },
        storage,
      );
      expect(result.variant).toBe('scheduled');
      expect(result.execution).toBeTruthy();
    });
  });

  describe('execute', () => {
    it('completes a scheduled execution', async () => {
      const { execution } = await executionHandler.schedule(
        { sourceRef: 'tl-1', actions: 'transfer(100)', executor: 'exec' },
        storage,
      );
      const result = await executionHandler.execute({ execution }, storage);
      expect(result.variant).toBe('completed');
      expect(result.result).toBe('success');
    });

    it('returns not_found for invalid id', async () => {
      const result = await executionHandler.execute({ execution: 'nonexistent' }, storage);
      expect(result.variant).toBe('not_found');
    });
  });

  describe('rollback', () => {
    it('rolls back a completed execution', async () => {
      const { execution } = await executionHandler.schedule(
        { sourceRef: 'tl-1', actions: 'transfer(100)', executor: 'exec' },
        storage,
      );
      await executionHandler.execute({ execution }, storage);
      const result = await executionHandler.rollback({ execution, reason: 'guard_failed' }, storage);
      expect(result.variant).toBe('rolled_back');
    });
  });
});
