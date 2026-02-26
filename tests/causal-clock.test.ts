// CausalClock concept handler tests -- tick, merge, compare, and dominates operations.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { causalClockHandler, resetCausalClockCounter } from '../handlers/ts/causal-clock.handler.js';

describe('CausalClock', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetCausalClockCounter();
  });

  describe('tick', () => {
    it('increments clock for a new replica', async () => {
      const result = await causalClockHandler.tick({ replicaId: 'r1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.timestamp).toBe('causal-clock-1');
      const clock = result.clock as number[];
      expect(clock.length).toBeGreaterThanOrEqual(1);
      // The replica's own entry should be 1
      expect(clock.some(v => v === 1)).toBe(true);
    });

    it('increments monotonically on subsequent ticks', async () => {
      const r1 = await causalClockHandler.tick({ replicaId: 'r1' }, storage);
      const r2 = await causalClockHandler.tick({ replicaId: 'r1' }, storage);
      const clock1 = r1.clock as number[];
      const clock2 = r2.clock as number[];
      // Second tick's value should be strictly greater at replica index
      const idx = clock1.findIndex(v => v === 1);
      expect(clock2[idx]).toBe(2);
    });

    it('handles multiple replicas independently', async () => {
      await causalClockHandler.tick({ replicaId: 'r1' }, storage);
      const r2 = await causalClockHandler.tick({ replicaId: 'r2' }, storage);
      expect(r2.variant).toBe('ok');
      // r2 should have its own slot incremented
      const clock = r2.clock as number[];
      expect(clock.filter(v => v === 1).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('merge', () => {
    it('produces component-wise maximum of two clocks', async () => {
      const result = await causalClockHandler.merge(
        { localClock: [3, 1, 0], remoteClock: [1, 4, 2] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.merged).toEqual([3, 4, 2]);
    });

    it('returns incompatible for non-array inputs', async () => {
      const result = await causalClockHandler.merge(
        { localClock: 'not-an-array', remoteClock: [1] },
        storage,
      );
      expect(result.variant).toBe('incompatible');
    });

    it('returns incompatible for differing clock dimensions', async () => {
      const result = await causalClockHandler.merge(
        { localClock: [1, 2], remoteClock: [1, 2, 3] },
        storage,
      );
      expect(result.variant).toBe('incompatible');
    });

    it('handles identical clocks', async () => {
      const result = await causalClockHandler.merge(
        { localClock: [2, 3], remoteClock: [2, 3] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.merged).toEqual([2, 3]);
    });
  });

  describe('compare', () => {
    it('detects after relationship when a has smaller clock than b', async () => {
      // e1 clock < e2 clock (e1 happened first, b dominates a)
      const e1 = await causalClockHandler.tick({ replicaId: 'r1' }, storage);
      const e2 = await causalClockHandler.tick({ replicaId: 'r1' }, storage);

      const result = await causalClockHandler.compare(
        { a: e1.timestamp as string, b: e2.timestamp as string },
        storage,
      );
      // Implementation returns 'after' when b dominates a (b's clock >= a's clock)
      expect(result.variant).toBe('after');
    });

    it('detects before relationship when a has larger clock than b', async () => {
      const e1 = await causalClockHandler.tick({ replicaId: 'r1' }, storage);
      const e2 = await causalClockHandler.tick({ replicaId: 'r1' }, storage);

      const result = await causalClockHandler.compare(
        { a: e2.timestamp as string, b: e1.timestamp as string },
        storage,
      );
      // Implementation returns 'before' when a dominates b (a's clock >= b's clock)
      expect(result.variant).toBe('before');
    });

    it('returns concurrent for non-existent events', async () => {
      const result = await causalClockHandler.compare(
        { a: 'nonexistent-1', b: 'nonexistent-2' },
        storage,
      );
      expect(result.variant).toBe('concurrent');
    });
  });

  describe('dominates', () => {
    it('returns true when a strictly dominates b', async () => {
      const e1 = await causalClockHandler.tick({ replicaId: 'r1' }, storage);
      const e2 = await causalClockHandler.tick({ replicaId: 'r1' }, storage);

      const result = await causalClockHandler.dominates(
        { a: e2.timestamp as string, b: e1.timestamp as string },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.result).toBe(true);
    });

    it('returns false when a does not dominate b', async () => {
      const e1 = await causalClockHandler.tick({ replicaId: 'r1' }, storage);
      const e2 = await causalClockHandler.tick({ replicaId: 'r1' }, storage);

      const result = await causalClockHandler.dominates(
        { a: e1.timestamp as string, b: e2.timestamp as string },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.result).toBe(false);
    });

    it('returns false for non-existent events', async () => {
      const result = await causalClockHandler.dominates(
        { a: 'nonexistent', b: 'also-nonexistent' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.result).toBe(false);
    });
  });
});
