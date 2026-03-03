// ============================================================
// Timelock Concept Conformance Tests
//
// Tests for governance timelock: schedule with delay,
// execute after ETA, cancel, and grace period handling.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { timelockHandler } from '../../handlers/ts/app/governance/timelock.handler.js';

describe('Timelock Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('schedule', () => {
    it('queues an operation with delay', async () => {
      const result = await timelockHandler.schedule(
        { operationHash: 'op-1', payload: 'transfer(100)', delayHours: 48, gracePeriodHours: 24 },
        storage,
      );
      expect(result.variant).toBe('queued');
      expect(result.lock).toBeTruthy();
    });
  });

  describe('execute', () => {
    it('returns not_ready when executed before ETA', async () => {
      const { lock } = await timelockHandler.schedule(
        { operationHash: 'op-1', payload: 'transfer(100)', delayHours: 9999, gracePeriodHours: 24 },
        storage,
      );
      const result = await timelockHandler.execute({ lock }, storage);
      expect(result.variant).toBe('not_ready');
    });
  });

  describe('cancel', () => {
    it('cancels a queued timelock', async () => {
      const { lock } = await timelockHandler.schedule(
        { operationHash: 'op-1', payload: 'transfer(100)', delayHours: 48, gracePeriodHours: 24 },
        storage,
      );
      const result = await timelockHandler.cancel({ lock, reason: 'proposal_vetoed' }, storage);
      expect(result.variant).toBe('cancelled');
    });

    it('returns not_found for invalid lock', async () => {
      const result = await timelockHandler.cancel({ lock: 'nonexistent', reason: 'test' }, storage);
      expect(result.variant).toBe('not_found');
    });
  });
});
