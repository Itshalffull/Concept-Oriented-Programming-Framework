// ============================================================
// Weight Concept Conformance Tests
//
// Tests for governance weight tracking: updates, snapshots,
// and weight retrieval.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { weightHandler } from '../../handlers/ts/app/governance/weight.handler.js';

describe('Weight Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('updateWeight', () => {
    it('sets weight for a participant', async () => {
      const result = await weightHandler.updateWeight({
        participant: 'alice', source: 'token-balance', value: 100,
      }, storage);
      expect(result.variant).toBe('updated');
    });
  });

  describe('getWeight', () => {
    it('retrieves weight for a participant', async () => {
      await weightHandler.updateWeight({ participant: 'alice', source: 'token', value: 75 }, storage);
      const result = await weightHandler.getWeight({ participant: 'alice' }, storage);
      expect(result.variant).toBe('weight');
      expect(result.total).toBe(75);
    });

    it('returns 0 for unknown participant', async () => {
      const result = await weightHandler.getWeight({ participant: 'nobody' }, storage);
      expect(result.total).toBe(0);
    });
  });

  describe('snapshot / getWeightFromSnapshot', () => {
    it('takes a snapshot and retrieves from it', async () => {
      await weightHandler.updateWeight({ participant: 'alice', source: 'token', value: 100 }, storage);
      await weightHandler.updateWeight({ participant: 'bob', source: 'token', value: 50 }, storage);

      const snap = await weightHandler.snapshot({
        snapshotRef: 'block-42', participants: ['alice', 'bob'],
      }, storage);
      expect(snap.variant).toBe('snapped');

      const fromSnap = await weightHandler.getWeightFromSnapshot({
        snapshot: snap.snapshot, participant: 'alice',
      }, storage);
      expect(fromSnap.variant).toBe('weight');
    });
  });
});
